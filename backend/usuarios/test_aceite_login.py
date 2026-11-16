from unittest.mock import patch

from allauth.account.models import EmailAddress
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from . import legal, mfa
from .authentication import versao_sessao
from .models import AceiteLegal, PoliticaPrivacidade, SegundoFator


@override_settings(RECAPTCHA_SECRET_KEY='teste')
class AceiteAntesDaSessaoTests(TestCase):
    def setUp(self):
        cache.clear()
        self.usuario = get_user_model().objects.create_user(
            'leitora',
            'leitora@example.test',
            'SenhaTeste123!',
        )
        EmailAddress.objects.create(
            user=self.usuario,
            email=self.usuario.email,
            primary=True,
            verified=True,
        )
        self.client = APIClient(enforce_csrf_checks=True)
        self.csrf = self.client.get('/api/auth/csrf/').data['csrf_token']

    def enviar(self, rota, dados=None, *, csrf=True):
        headers = {'HTTP_X_CSRFTOKEN': self.csrf} if csrf else {}
        resposta = self.client.post(rota, dados or {}, format='json', **headers)
        if isinstance(resposta.data, dict) and 'csrf_token' in resposta.data:
            self.csrf = resposta.data['csrf_token']
        return resposta

    def login(self):
        with patch('usuarios.views.requests.post') as google:
            google.return_value.json.return_value = {'success': True}
            return self.enviar(
                '/api/auth/login/',
                {
                    'email': self.usuario.email,
                    'password': 'SenhaTeste123!',
                    'captcha_token': 'validado',
                },
            )

    def dados_aceite(self, desafio):
        return {
            'challenge': desafio,
            'aceite_termos': True,
            'ciencia_privacidade': True,
            'termos_versao': legal.termos_vigentes().versao,
            'privacidade_versao': legal.politica_vigente().versao,
        }

    def test_exige_documentos_vigentes_e_invalida_sessao_quando_mudam(self):
        rota = '/api/auth/documentos/aceitar/'
        login = self.login()
        self.assertTrue(login.data['legal_required'])
        self.assertEqual(self.client.get('/api/auth/account/').status_code, 401)

        dados = self.dados_aceite(login.data['challenge'])
        self.assertEqual(self.enviar(rota, dados, csrf=False).status_code, 403)
        self.assertEqual(
            self.enviar(rota, {**dados, 'aceite_termos': False}).status_code, 400
        )
        self.assertEqual(
            self.enviar(rota, {**dados, 'privacidade_versao': 'antiga'}).status_code,
            400,
        )
        self.assertEqual(AceiteLegal.objects.count(), 0)

        self.assertEqual(self.enviar(rota, dados).status_code, 200)
        self.assertEqual(self.client.get('/api/auth/account/').status_code, 200)
        self.assertEqual(AceiteLegal.objects.filter(usuario=self.usuario).count(), 2)
        self.assertEqual(self.enviar(rota, dados).status_code, 400)

        versao_anterior = legal.politica_vigente().versao
        total_politicas = PoliticaPrivacidade.objects.count()
        admin = get_user_model().objects.create_superuser('publicador')
        SegundoFator.objects.create(
            usuario=admin, segredo='ABCDEFGHIJKLMNOP', ativo=True
        )
        navegador_admin = APIClient()
        navegador_admin.force_login(admin)
        sessao = navegador_admin.session
        sessao['locus_admin_mfa_user'] = str(admin.pk)
        sessao['locus_admin_mfa_version'] = versao_sessao(admin)
        sessao.save()
        resposta = navegador_admin.post(
            '/admin/usuarios/politicaprivacidade/add/',
            {
                'versao': '2.0',
                'conteudo': 'Política publicada pelo administrador.',
            },
        )
        self.assertEqual(resposta.status_code, 302)
        self.assertEqual(PoliticaPrivacidade.objects.count(), total_politicas + 1)
        self.assertEqual(self.client.get('/api/auth/account/').status_code, 401)
        self.assertEqual(self.enviar('/api/auth/token/refresh/').status_code, 401)
        vigente = self.client.get('/api/auth/documentos/privacidade/').data
        self.assertEqual(vigente['versao'], '2.0')
        self.assertEqual(vigente['conteudo'], 'Política publicada pelo administrador.')
        novo_login = self.login()
        self.assertTrue(novo_login.data['legal_required'])
        self.assertEqual(novo_login.data['politica'], vigente)
        self.assertEqual(
            self.enviar(
                rota, self.dados_aceite(novo_login.data['challenge'])
            ).status_code,
            200,
        )
        self.assertTrue(
            AceiteLegal.objects.filter(
                usuario=self.usuario, tipo_documento='privacy', versao=versao_anterior
            ).exists()
        )
        self.assertTrue(
            AceiteLegal.objects.filter(
                usuario=self.usuario, tipo_documento='privacy', versao='2.0'
            ).exists()
        )

    def test_publicar_termos_no_admin_preserva_historico_e_exige_novo_aceite(self):
        rota = '/api/auth/documentos/aceitar/'
        primeira_versao = self.client.get('/api/auth/documentos/termos/').data
        self.assertEqual(primeira_versao['versao'], '1.3')
        self.assertEqual(
            legal.documentos_vigentes()[0][3],
            'a545367cbf526bf9c4174775b623b28c652ae4d27560f2089e3506477db58a59',
        )
        login = self.login()
        self.assertEqual(login.data['termos'], primeira_versao)
        aceite = self.enviar(rota, self.dados_aceite(login.data['challenge']))
        self.assertEqual(aceite.status_code, 200)

        admin = get_user_model().objects.create_superuser('publicador_termos')
        SegundoFator.objects.create(
            usuario=admin, segredo='ABCDEFGHIJKLMNOP', ativo=True
        )
        painel = APIClient()
        painel.force_login(admin)
        sessao = painel.session
        sessao['locus_admin_mfa_user'] = str(admin.pk)
        sessao['locus_admin_mfa_version'] = versao_sessao(admin)
        sessao.save()
        resposta = painel.post(
            '/admin/usuarios/termosuso/add/',
            {'versao': '1.4', 'conteudo': '## Condições\n\nTexto atualizado.'},
        )
        self.assertEqual(resposta.status_code, 302)
        vigente = self.client.get('/api/auth/documentos/termos/').data
        self.assertEqual(vigente['versao'], '1.4')
        self.assertEqual(vigente['conteudo'], '## Condições\n\nTexto atualizado.')
        self.assertEqual(self.client.get('/api/auth/account/').status_code, 401)

        login = self.login()
        self.assertEqual(login.data['termos'], vigente)
        dados = self.dados_aceite(login.data['challenge'])
        self.assertEqual(
            self.enviar(rota, {**dados, 'termos_versao': '1.3'}).status_code, 400
        )
        self.assertEqual(self.enviar(rota, dados).status_code, 200)
        self.assertEqual(
            set(
                AceiteLegal.objects.filter(
                    usuario=self.usuario, tipo_documento='terms'
                ).values_list('versao', flat=True)
            ),
            {'1.3', '1.4'},
        )

    def test_aceite_continua_com_segundo_fator(self):
        SegundoFator.objects.create(
            usuario=self.usuario, segredo='ABCDEFGHIJKLMNOP', ativo=True
        )
        login = self.login()
        aceite = self.enviar(
            '/api/auth/documentos/aceitar/', self.dados_aceite(login.data['challenge'])
        )
        self.assertTrue(aceite.data['mfa_required'])
        self.assertEqual(self.client.get('/api/auth/account/').status_code, 401)
        self.assertTrue(mfa.ativo(self.usuario))
