from unittest.mock import Mock, patch

from allauth.account.models import EmailAddress
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import AceiteLegal


@override_settings(RECAPTCHA_SECRET_KEY='segredo-teste')
class LoginSecurityTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(
            username='teste', email='teste@example.com', password='senha123'
        )
        EmailAddress.objects.create(
            user=self.user,
            email=self.user.email,
            primary=True,
            verified=True,
        )
        self.client = APIClient()

    def test_login_exige_captcha(self):
        resposta = self.client.post('/api/auth/login/', {
            'email': 'teste@example.com',
            'password': 'senha123',
        }, format='json')
        self.assertEqual(resposta.status_code, 400)

    @patch('usuarios.views.requests.post')
    def test_login_valido_retorna_tokens(self, post):
        resposta_google = Mock()
        resposta_google.raise_for_status.return_value = None
        resposta_google.json.return_value = {'success': True}
        post.return_value = resposta_google

        resposta = self.client.post('/api/auth/login/', {
            'email': 'teste@example.com',
            'password': 'senha123',
            'captcha_token': 'token-valido',
        }, format='json')

        self.assertEqual(resposta.status_code, 200)
        self.assertIn('access', resposta.data)
        self.assertIn('refresh', resposta.data)

    @patch('usuarios.views.requests.post')
    def test_captcha_invalido_bloqueia_login(self, post):
        resposta_google = Mock()
        resposta_google.raise_for_status.return_value = None
        resposta_google.json.return_value = {'success': False}
        post.return_value = resposta_google

        resposta = self.client.post('/api/auth/login/', {
            'email': 'teste@example.com',
            'password': 'senha123',
            'captcha_token': 'token-invalido',
        }, format='json')

        self.assertEqual(resposta.status_code, 400)
        self.assertNotIn('access', resposta.data)


class RegistrationLegalAcceptanceTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.payload = {
            'username': 'novo_usuario',
            'email': 'novo@example.com',
            'password1': 'senha12345',
            'password2': 'senha12345',
        }

    def test_cadastro_exige_termos_e_ciencia_da_privacidade(self):
        resposta = self.client.post('/api/auth/registro/', self.payload, format='json')

        self.assertEqual(resposta.status_code, 400)
        self.assertIn('aceite_termos', resposta.data)
        self.assertIn('ciencia_privacidade', resposta.data)
        self.assertFalse(get_user_model().objects.filter(username='novo_usuario').exists())

    def test_cadastro_registra_duas_manifestacoes_legais(self):
        payload = {
            **self.payload,
            'aceite_termos': True,
            'ciencia_privacidade': True,
        }

        resposta = self.client.post(
            '/api/auth/registro/',
            payload,
            format='json',
            HTTP_USER_AGENT='Locus-Test/1.0',
            REMOTE_ADDR='127.0.0.1',
        )

        self.assertEqual(resposta.status_code, 201)
        user = get_user_model().objects.get(username='novo_usuario')
        registros = AceiteLegal.objects.filter(usuario=user)
        self.assertEqual(registros.count(), 2)

        termos = registros.get(tipo_documento=AceiteLegal.TipoDocumento.TERMOS)
        privacidade = registros.get(tipo_documento=AceiteLegal.TipoDocumento.PRIVACIDADE)

        self.assertEqual(termos.tipo_manifestacao, AceiteLegal.TipoManifestacao.ACEITE)
        self.assertEqual(privacidade.tipo_manifestacao, AceiteLegal.TipoManifestacao.CIENCIA)
        self.assertEqual(termos.endereco_ip, '127.0.0.1')
        self.assertEqual(termos.user_agent, 'Locus-Test/1.0')
        self.assertTrue(termos.hash_documento)
        self.assertTrue(privacidade.hash_documento)
