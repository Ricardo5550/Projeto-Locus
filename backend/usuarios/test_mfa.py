from datetime import timedelta
from datetime import datetime
import re
from unittest.mock import patch

import pyotp
from allauth.account.models import EmailAddress
from django.contrib import admin
from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.core.management import call_command
from django.db import connection, transaction
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from auditoria.models import RegistroAtividade
from . import mfa
from .authentication import versao_sessao
from .models import SegundoFator, DesafioAutenticacao


@override_settings(RECAPTCHA_SECRET_KEY='teste', JWT_COOKIE_SECURE=False)
class MFATests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = get_user_model().objects.create_user('mfa', 'mfa@example.test', 'SenhaTeste123!')
        EmailAddress.objects.create(user=self.user, email=self.user.email, primary=True, verified=True)
        self.client = APIClient(enforce_csrf_checks=True)
        self.csrf = self.client.get('/api/auth/csrf/').data['csrf_token']

    def post(self, route, data):
        response = self.client.post(route, data, format='json', HTTP_X_CSRFTOKEN=self.csrf)
        if isinstance(getattr(response, 'data', None), dict) and response.data.get('csrf_token'):
            self.csrf = response.data['csrf_token']
        return response

    def login(self):
        with patch('usuarios.views.requests.post') as google:
            google.return_value.json.return_value = {'success': True}
            return self.post('/api/auth/login/', {'email': self.user.email, 'password': 'SenhaTeste123!', 'captcha_token': 'ok'})

    def device(self):
        return SegundoFator.objects.create(usuario=self.user, segredo=pyotp.random_base32(), ativo=True)

    def factor(self, challenge, code):
        return self.post('/api/auth/mfa/verify/', {'challenge': challenge, 'code': code})

    def test_primeira_etapa_nao_libera_sessao(self):
        self.device()
        response = self.login()
        self.assertTrue(response.data['mfa_required'])
        self.assertNotIn('access', response.data)
        self.assertEqual(response.cookies['locus_access']['max-age'], 0)
        self.assertEqual(self.client.get('/api/auth/account/').status_code, 401)
        row = DesafioAutenticacao.objects.get()
        self.assertNotEqual(row.resumo, response.data['challenge'])
        self.assertNotIn('SenhaTeste123!', row.senha_assinada)

    def test_totp_valido_libera_cookies_e_rejeita_replay(self):
        device = self.device()
        challenge = self.login().data['challenge']
        code = pyotp.TOTP(device.segredo).now()
        response = self.factor(challenge, code)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.cookies['locus_access']['httponly'])
        self.assertEqual(self.client.get('/api/auth/account/').status_code, 200)
        self.assertEqual(self.factor(challenge, code).status_code, 400)
        challenge2 = self.login().data['challenge']
        self.assertEqual(self.factor(challenge2, code).status_code, 400)

    def test_cinco_falhas_encerram_desafio(self):
        device = self.device()
        challenge = self.login().data['challenge']
        for _ in range(5):
            self.assertEqual(self.factor(challenge, 'invalido').status_code, 400)
        self.assertEqual(DesafioAutenticacao.objects.get().tentativas, 5)
        self.assertEqual(self.factor(challenge, pyotp.TOTP(device.segredo).now()).status_code, 400)
        self.assertEqual(self.client.get('/api/auth/account/').status_code, 401)

    def test_expiracao_e_nova_solicitacao_invalidam_desafio(self):
        device = self.device()
        old = self.login().data['challenge']
        fresh = self.login().data['challenge']
        code = pyotp.TOTP(device.segredo).now()
        self.assertEqual(self.factor(old, code).status_code, 400)
        DesafioAutenticacao.objects.filter(resumo=mfa.resumo(fresh)).update(expira_em=timezone.now()-timedelta(seconds=1))
        self.assertEqual(self.factor(fresh, code).status_code, 400)

    def test_senha_alterada_conta_suspensa_e_revogacao_invalidam_desafio(self):
        device = self.device()
        for change in ('password', 'active', 'version'):
            self.user.set_password('SenhaTeste123!'); self.user.is_active=True; self.user.save()
            cache.clear()
            challenge = self.login().data['challenge']
            if change == 'password':
                self.user.set_password('OutraSenha456!'); self.user.save()
            elif change == 'active':
                self.user.is_active=False; self.user.save()
            else:
                mfa.revogar_sessoes(self.user)
            self.assertEqual(self.factor(challenge, pyotp.TOTP(device.segredo).now()).status_code, 400)

    def test_recuperacao_funciona_uma_vez_e_nao_fica_em_texto_puro(self):
        device = self.device()
        codes = mfa.gerar_recuperacao(device)
        device.refresh_from_db()
        self.assertEqual(len(codes), 2)
        self.assertNotIn(codes[0], str(device.recuperacao))
        challenge = self.login().data['challenge']
        self.assertEqual(self.factor(challenge, codes[0]).status_code, 200)
        device.refresh_from_db(); self.assertEqual(len(device.recuperacao), 1)
        challenge = self.login().data['challenge']
        self.assertEqual(self.factor(challenge, codes[0]).status_code, 400)

    def test_csrf_obrigatorio_na_validacao_e_no_cadastro_de_fator(self):
        device = self.device()
        challenge = self.login().data['challenge']
        for path in ('/api/auth/mfa/verify/', '/api/auth/mfa/enroll/'):
            response = self.client.post(path, {'challenge': challenge, 'code': pyotp.TOTP(device.segredo).now()}, format='json')
            self.assertEqual(response.status_code, 403)

    def test_codigo_nao_serve_para_outra_conta_e_desafio_admin_nao_serve_na_api(self):
        self.device()
        other = get_user_model().objects.create_user('outro_mfa', 'other@example.test', 'senha')
        secret = pyotp.random_base32()
        SegundoFator.objects.create(usuario=other, segredo=secret, ativo=True)
        challenge = self.login().data['challenge']
        # Um código de recuperação é específico do usuário e não sofre colisão de seis dígitos.
        other_device = SegundoFator.objects.get(usuario=other)
        self.assertEqual(self.factor(challenge, mfa.gerar_recuperacao(other_device)[0]).status_code, 400)
        value = mfa.criar_desafio(self.user, 'admin')
        self.assertEqual(self.factor(value, pyotp.TOTP(secret).now()).status_code, 400)

    def test_administrador_sem_fator_recebe_apenas_desafio_de_configuracao(self):
        self.user.is_staff=True; self.user.save()
        response = self.login()
        self.assertTrue(response.data['setup_required'])
        value = response.data['challenge']
        setup = self.post('/api/auth/mfa/enroll/', {'challenge': value})
        self.assertEqual(setup.status_code, 200)
        self.assertTrue(setup.data['qr_code'].startswith('data:image/svg+xml;base64,'))
        response = self.post('/api/auth/mfa/enroll/', {'challenge': value, 'code': pyotp.TOTP(setup.data['secret']).now()})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(len(response.data['recovery_codes']), 2)
        self.assertEqual(self.client.get('/api/auth/account/').status_code, 200)

    def test_usuario_ativa_fator_e_tokens_antigos_perdem_validade(self):
        self.assertEqual(self.login().status_code, 200)
        old_access = self.client.cookies['locus_access'].value
        setup = self.post('/api/auth/mfa/', {'action': 'setup', 'password': 'SenhaTeste123!', 'code': ''})
        self.assertEqual(setup.status_code, 200, setup.data)
        secret = setup.data['secret']
        response = self.post('/api/auth/mfa/', {'action': 'activate', 'password': 'SenhaTeste123!', 'code': pyotp.TOTP(secret).now()})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(len(response.data['recovery_codes']), 2)
        self.assertTrue(self.client.get('/api/auth/mfa/').data['enabled'])
        self.client.cookies['locus_access'] = old_access
        self.assertEqual(self.client.get('/api/auth/account/').status_code, 401)
        with connection.cursor() as cursor:
            cursor.execute('SELECT segredo FROM usuarios_segundofator WHERE usuario_id = %s', [self.user.pk])
            encrypted = cursor.fetchone()[0]
        self.assertTrue(encrypted.startswith('enc:v1:'))
        self.assertNotIn(secret, encrypted)

    def test_gestao_exige_senha_e_segundo_fator_e_staff_nao_desativa(self):
        device = self.device()
        codes = mfa.gerar_recuperacao(device)
        self.client.force_authenticate(self.user)
        self.assertEqual(self.post('/api/auth/mfa/', {'action': 'regenerate', 'password': 'errada', 'code': codes[0]}).status_code, 400)
        self.assertEqual(self.post('/api/auth/mfa/', {'action': 'regenerate', 'password': 'SenhaTeste123!', 'code': 'invalido'}).status_code, 400)
        response = self.post('/api/auth/mfa/', {'action': 'regenerate', 'password': 'SenhaTeste123!', 'code': codes[0]})
        self.assertEqual(response.status_code, 200)
        self.assertNotEqual(codes, response.data['recovery_codes'])
        device.refresh_from_db(); self.assertFalse(mfa.validar_codigo(device, codes[1]))
        self.user.is_staff=True; self.user.save()
        self.assertEqual(self.post('/api/auth/mfa/', {'action': 'disable', 'password': 'SenhaTeste123!', 'code': response.data['recovery_codes'][0]}).status_code, 403)

    def test_codigo_expirado_nao_ativa_e_fator_ativo_nao_expoe_segredo(self):
        self.client.force_authenticate(self.user)
        setup = self.post('/api/auth/mfa/', {'action': 'setup', 'password': 'SenhaTeste123!'})
        SegundoFator.objects.filter(usuario=self.user).update(criado_em=timezone.now()-timedelta(minutes=6))
        response = self.post('/api/auth/mfa/', {'action': 'activate', 'password': 'SenhaTeste123!', 'code': pyotp.TOTP(setup.data['secret']).now()})
        self.assertEqual(response.status_code, 400)
        SegundoFator.objects.filter(usuario=self.user).update(ativo=True)
        self.assertEqual(self.post('/api/auth/mfa/', {'action': 'setup', 'password': 'SenhaTeste123!'}).status_code, 400)
        self.assertNotIn('secret', self.client.get('/api/auth/mfa/').data)

    def test_cookie_sem_comprovacao_de_mfa_e_recusado_inclusive_no_refresh(self):
        self.device()
        refresh = RefreshToken.for_user(self.user)
        refresh['session_version'] = versao_sessao(self.user)
        self.client.cookies['locus_access'] = str(refresh.access_token)
        self.client.cookies['locus_refresh'] = str(refresh)
        self.assertEqual(self.client.get('/api/auth/account/').status_code, 401)
        self.assertEqual(self.post('/api/auth/token/refresh/', {}).status_code, 401)

    def test_auditoria_nao_contem_senhas_codigos_chaves_ou_tokens(self):
        device = self.device()
        challenge = self.login().data['challenge']
        code = pyotp.TOTP(device.segredo).now()
        self.factor(challenge, code)
        logs = str(list(RegistroAtividade.objects.values()))
        for value in ('SenhaTeste123!', device.segredo, challenge, code):
            self.assertNotIn(value, logs)
        self.assertTrue(RegistroAtividade.objects.filter(acao='mfa_sucesso', resultado='sucesso').exists())

    def test_desativacao_exige_fator_e_revoga_sessoes(self):
        device = self.device()
        codes = mfa.gerar_recuperacao(device)
        self.client.force_authenticate(self.user)
        old = versao_sessao(self.user)
        response = self.post('/api/auth/mfa/', {'action': 'disable', 'password': 'SenhaTeste123!', 'code': codes[0]})
        self.assertEqual(response.status_code, 200)
        self.assertFalse(SegundoFator.objects.filter(usuario=self.user).exists())
        self.assertGreater(versao_sessao(self.user), old)

    def test_recuperar_senha_nao_remove_2fa_e_link_expira_e_funciona_uma_vez(self):
        self.device()
        response = self.post('/api/auth/password/reset/', {'email': self.user.email})
        self.assertEqual(response.status_code, 200)
        uid, token = re.search(r'/password/reset/link/([^/\s]+)/([^/\s]+)/', mail.outbox[-1].body).groups()
        payload = {'uid': uid, 'token': token, 'new_password1': 'OutraSenha456!', 'new_password2': 'OutraSenha456!'}
        with patch('django.contrib.auth.tokens.PasswordResetTokenGenerator._now', return_value=datetime.now()+timedelta(days=4)):
            self.assertEqual(self.post('/api/auth/password/reset/confirm/', payload).status_code, 400)
        self.assertEqual(self.post('/api/auth/password/reset/confirm/', payload).status_code, 200)
        self.assertEqual(self.post('/api/auth/password/reset/confirm/', payload).status_code, 400)
        self.assertTrue(mfa.ativo(self.user))
        self.assertTrue(RegistroAtividade.objects.filter(acao='recuperacao_solicitada').exists())
        self.assertTrue(RegistroAtividade.objects.filter(acao='recuperacao_concluida', recurso_id=self.user.pk).exists())
        self.assertTrue(RegistroAtividade.objects.filter(acao='recuperacao_confirmacao_falha').exists())

    def test_falha_smtp_registra_evento_sem_expor_detalhes(self):
        with patch('dj_rest_auth.serializers.PasswordResetSerializer.save', side_effect=RuntimeError('segredo de teste')):
            response = self.post('/api/auth/password/reset/', {'email': self.user.email})
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('segredo de teste', str(response.data))
        self.assertTrue(RegistroAtividade.objects.filter(acao='recuperacao_envio_falha', resultado='falha').exists())

    def test_excluir_conta_remove_fator_e_desafios(self):
        self.device()
        mfa.criar_desafio(self.user, 'api')
        self.client.force_authenticate(self.user)
        response = self.client.delete('/api/auth/account/', {'password': 'SenhaTeste123!'}, format='json', HTTP_X_CSRFTOKEN=self.csrf)
        self.assertEqual(response.status_code, 204)
        self.assertFalse(SegundoFator.objects.filter(usuario=self.user).exists())
        self.assertFalse(DesafioAutenticacao.objects.filter(usuario=self.user).exists())


class AdminMFATests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = get_user_model().objects.create_superuser('adminmfa', 'admin@example.test', 'SenhaTeste123!')
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.get('/admin/login/')
        self.csrf = self.client.cookies['csrftoken'].value

    def post(self, data):
        response = self.client.post('/admin/login/', data, HTTP_X_CSRFTOKEN=self.csrf)
        self.csrf = self.client.cookies['csrftoken'].value
        return response

    def test_admin_so_libera_painel_apos_ativacao_e_exibe_codigos_uma_vez(self):
        response = self.post({'username': self.user.username, 'password': 'SenhaTeste123!'})
        self.assertEqual(response.context_data['phase'], 'setup')
        self.assertNotIn('_auth_user_id', self.client.session)
        self.assertEqual(self.client.get('/admin/').status_code, 302)
        secret = response.context_data['secret']
        response = self.post({'code': pyotp.TOTP(secret).now(), 'next': 'https://intruso.example/'})
        self.assertEqual(response.context_data['phase'], 'recovery')
        self.assertEqual(len(response.context_data['recovery_codes']), 2)
        self.assertEqual(self.client.get('/admin/').status_code, 200)
        self.assertNotIn('recovery_codes', self.client.session)
        self.assertFalse(response.context_data['next'].startswith('https://intruso'))

    def test_sessao_django_sem_mfa_nao_entra_no_admin(self):
        self.client.force_login(self.user)
        self.assertEqual(self.client.get('/admin/').status_code, 302)

    def test_admin_totp_e_recuperacao_sem_replay_e_revogacao_da_sessao(self):
        device = SegundoFator.objects.create(usuario=self.user, segredo=pyotp.random_base32(), ativo=True)
        codes = mfa.gerar_recuperacao(device)
        self.post({'username': self.user.username, 'password': 'SenhaTeste123!'})
        response = self.post({'code': codes[0]})
        self.assertEqual(response.status_code, 302)
        self.assertEqual(self.client.get('/admin/').status_code, 200)
        mfa.revogar_sessoes(self.user)
        self.assertEqual(self.client.get('/admin/').status_code, 302)

    def test_admin_logout_registra_evento(self):
        device = SegundoFator.objects.create(usuario=self.user, segredo=pyotp.random_base32(), ativo=True)
        code = mfa.gerar_recuperacao(device)[0]
        self.post({'username': self.user.username, 'password': 'SenhaTeste123!'})
        self.post({'code': code})
        response = self.client.post('/admin/logout/', HTTP_X_CSRFTOKEN=self.csrf)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(RegistroAtividade.objects.filter(acao='admin_logout', usuario=self.user).exists())

    def test_usuario_comum_nao_pode_entrar_no_admin(self):
        get_user_model().objects.create_user('comum', 'common@example.test', 'SenhaTeste123!')
        response = self.post({'username': 'comum', 'password': 'SenhaTeste123!'})
        self.assertEqual(response.context_data['phase'], 'password')
        self.assertNotIn('locus_admin_challenge', self.client.session)

    def test_admin_codigo_incorreto_nao_libera_sessao_e_exige_csrf(self):
        self.post({'username': self.user.username, 'password': 'SenhaTeste123!'})
        self.assertEqual(self.client.post('/admin/login/', {'code': '000000'}).status_code, 403)
        for _ in range(5):
            self.post({'code': 'invalido'})
        response = self.post({'code': 'invalido'})
        self.assertEqual(response.context_data['phase'], 'password')
        self.assertNotIn('_auth_user_id', self.client.session)


class SupportTests(TestCase):
    def setUp(self):
        cache.clear()
        self.support = get_user_model().objects.create_user('suporte', 'support@example.test', 'SenhaTeste123!')
        call_command('configurar_admin', self.support.username, perfil='suporte', verbosity=0)
        self.support.refresh_from_db()
        self.other = get_user_model().objects.create_user('aluno', 'student@example.test', 'SenhaTeste123!')
        self.admin_user = get_user_model().objects.create_superuser('dono', 'owner@example.test', 'SenhaTeste123!')
        self.client = APIClient()
        self.client.force_login(self.support)
        SegundoFator.objects.create(usuario=self.support, segredo=pyotp.random_base32(), ativo=True)
        session = self.client.session
        session['locus_admin_mfa_user'] = self.support.pk
        session['locus_admin_mfa_version'] = versao_sessao(self.support)
        session.save()

    def action(self, name, user=None, reason='Atendimento solicitado pelo titular'):
        return self.client.post('/admin/auth/user/', {'action': name, '_selected_action': (user or self.other).pk,
            'confirmar_atendimento': '1', 'motivo': reason})

    def test_perfil_nao_concede_priviliegios_ou_acesso_a_conteudos(self):
        self.assertTrue(self.support.is_staff)
        self.assertFalse(self.support.is_superuser)
        self.assertTrue(self.support.has_perm('auth.view_user'))
        self.assertFalse(self.support.has_perm('auth.change_user'))
        self.assertFalse(self.support.has_perm('anotacoes.view_anotacao'))
        self.assertEqual(self.client.get('/admin/anotacoes/anotacao/').status_code, 403)
        page = self.client.get(f'/admin/auth/user/{self.other.pk}/change/')
        self.assertEqual(page.status_code, 200)
        self.assertNotContains(page, self.other.password)
        self.assertEqual(self.client.get(f'/admin/auth/user/{self.admin_user.pk}/change/').status_code, 302)

    def test_suspender_reativar_e_encerrar_sessoes_com_motivo(self):
        old = versao_sessao(self.other)
        self.action('suspender')
        self.other.refresh_from_db(); self.assertFalse(self.other.is_active)
        self.assertGreater(versao_sessao(self.other), old)
        self.action('reativar')
        self.other.refresh_from_db(); self.assertTrue(self.other.is_active)
        row = RegistroAtividade.objects.get(acao='suporte_suspender')
        self.assertEqual(row.usuario, self.support)
        self.assertEqual(row.recurso_id, self.other.pk)
        self.assertIn('titular', row.descricao)

    def test_sem_motivo_nao_executa_e_staff_nao_e_alvo(self):
        self.action('suspender', reason='')
        self.other.refresh_from_db(); self.assertTrue(self.other.is_active)
        self.action('suspender', user=self.admin_user)
        self.admin_user.refresh_from_db(); self.assertTrue(self.admin_user.is_active)

    def test_envio_recuperacao_e_verificacao_nao_marca_email_como_confirmado(self):
        address = EmailAddress.objects.create(user=self.other, email=self.other.email, verified=False, primary=True)
        self.action('reenviar_confirmacao')
        address.refresh_from_db(); self.assertFalse(address.verified)
        self.assertEqual(len(mail.outbox), 1)
        self.action('enviar_recuperacao')
        self.assertEqual(len(mail.outbox), 2)

    def test_auditoria_somente_leitura(self):
        modeladmin = admin.site._registry[RegistroAtividade]
        from django.test import RequestFactory
        request = RequestFactory().get('/admin/'); request.user = self.support
        self.assertFalse(modeladmin.has_add_permission(request))
        self.assertFalse(modeladmin.has_change_permission(request))
        self.assertFalse(modeladmin.has_delete_permission(request))

    def test_redefinicao_excepcional_pelo_servidor_invalida_codigos_e_sessoes(self):
        device = SegundoFator.objects.get(usuario=self.support)
        code = mfa.gerar_recuperacao(device)[0]
        old = versao_sessao(self.support)
        call_command('resetar_2fa', self.support.username, motivo='Identidade conferida pelo operador', confirmar=self.support.username, verbosity=0)
        self.assertFalse(mfa.ativo(self.support))
        self.assertGreater(versao_sessao(self.support), old)
        self.assertEqual(self.client.get('/admin/').status_code, 302)
        self.assertTrue(RegistroAtividade.objects.filter(acao='mfa_redefinido_servidor', recurso_id=self.support.pk).exists())


class AuditIPTests(TestCase):
    def test_header_nao_confiavel_nao_define_ip_dos_aceites_ou_auditoria(self):
        from django.test import RequestFactory
        from django.contrib.auth.models import AnonymousUser
        from usuarios.legal import obter_ip_cliente
        from auditoria.services import registrar_atividade
        request = RequestFactory().get('/', REMOTE_ADDR='192.0.2.1', HTTP_X_FORWARDED_FOR='203.0.113.9')
        request.user = AnonymousUser()
        self.assertEqual(obter_ip_cliente(request), '192.0.2.1')
        row = registrar_atividade(request, 'solicitar_alteracao_email', 'conta')
        self.assertEqual(row.endereco_ip, '192.0.2.1')
        row.full_clean()

    def test_cadeia_de_proxy_configurada_e_ip_malformado(self):
        from django.conf import settings
        from django.test import RequestFactory
        from core.ip import obter_ip_cliente
        config = {**settings.REST_FRAMEWORK, 'NUM_PROXIES': 1}
        with override_settings(REST_FRAMEWORK=config):
            request = RequestFactory().get('/', REMOTE_ADDR='192.0.2.1', HTTP_X_FORWARDED_FOR='forjado,203.0.113.7')
            self.assertEqual(obter_ip_cliente(request), '203.0.113.7')
        self.assertIsNone(obter_ip_cliente(RequestFactory().get('/', REMOTE_ADDR='invalido')))
