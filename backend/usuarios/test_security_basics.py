from unittest.mock import patch

from allauth.account.models import EmailAddress
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core import mail
from django.test import TestCase, override_settings
from django.urls import resolve, Resolver404
from rest_framework.test import APIClient
from rest_framework.throttling import UserRateThrottle


class SecurityBasicsTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = get_user_model().objects.create_user('seguranca', 'security@example.test', 'SenhaTeste123!')
        EmailAddress.objects.create(user=self.user, email=self.user.email, verified=True, primary=True)
        self.client = APIClient(enforce_csrf_checks=True)
        self.csrf = self.client.get('/api/auth/csrf/').data['csrf_token']

    def post(self, route, data, **extra):
        return self.client.post(route, data, format='json', HTTP_X_CSRFTOKEN=self.csrf, **extra)

    def test_aliases_usam_somente_views_do_locus(self):
        for route in ('login', 'logout', 'token/refresh'):
            for suffix in ('', '/'):
                with self.subTest(route=route, suffix=suffix):
                    self.assertEqual(resolve('/api/auth/' + route + suffix).func.view_class.__module__, 'usuarios.views')
        for route in ('user/', 'token/verify/', 'token/verify'):
            with self.subTest(route=route), self.assertRaises(Resolver404):
                resolve('/api/auth/' + route)

    def test_login_com_e_sem_barra_exige_captcha(self):
        with patch('usuarios.views.requests.post') as google:
            for suffix in ('', '/'):
                response = self.post('/api/auth/login' + suffix, {'email': self.user.email, 'password': 'SenhaTeste123!'})
                self.assertEqual(response.status_code, 400)
                self.assertNotIn('access', response.data)
            google.assert_not_called()

    @override_settings(RECAPTCHA_SECRET_KEY='teste')
    def test_login_sem_barra_usa_apenas_cookies_e_exige_csrf(self):
        payload = {'email': self.user.email, 'password': 'SenhaTeste123!', 'captcha_token': 'ok'}
        with patch('usuarios.views.requests.post') as google:
            google.return_value.json.return_value = {'success': True}
            self.assertEqual(self.client.post('/api/auth/login', payload, format='json').status_code, 403)
            response = self.post('/api/auth/login', payload)
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('access', response.data)
        self.assertNotIn('refresh', response.data)
        self.assertTrue(response.cookies['locus_access']['httponly'])
        self.assertNotIn('sessionid', response.cookies)

    def test_limite_login_compartilhado_entre_aliases_e_ignora_forward_for_forjado(self):
        payload = {'email': self.user.email, 'password': 'errada'}
        for i in range(5):
            response = self.post('/api/auth/login' + ('/' if i % 2 else ''), payload,
                                 HTTP_X_FORWARDED_FOR=f'192.0.2.{i}')
            self.assertEqual(response.status_code, 400)
        response = self.post('/api/auth/login/', payload, HTTP_X_FORWARDED_FOR='192.0.2.99')
        self.assertEqual(response.status_code, 429)
        self.assertIn('Retry-After', response)
        other = APIClient()
        self.assertEqual(other.post('/api/auth/login/', payload, format='json', REMOTE_ADDR='192.0.2.77').status_code, 400)

    def test_limite_ip_nao_pode_ser_contornado_trocando_email(self):
        for i in range(10):
            response = self.post('/api/auth/login/', {'email': f'a{i}@example.test', 'password': 'errada'})
            self.assertEqual(response.status_code, 400)
        self.assertEqual(self.post('/api/auth/login/', {'email': 'outro@example.test', 'password': 'errada'}).status_code, 429)

    def test_recuperacao_exige_csrf_e_tem_limite(self):
        self.assertEqual(self.client.post('/api/auth/password/reset/', {'email': 'naoexiste@example.test'}, format='json').status_code, 403)
        cache.clear()
        for _ in range(5):
            self.assertEqual(self.post('/api/auth/password/reset/', {'email': 'naoexiste@example.test'}).status_code, 200)
        self.assertEqual(self.post('/api/auth/password/reset/', {'email': 'naoexiste@example.test'}).status_code, 429)

    def test_recuperacao_envia_link_para_rota_preservada(self):
        response = self.post('/api/auth/password/reset/', {'email': self.user.email})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('/api/auth/password/reset/link/', mail.outbox[0].body)

    def test_cadastro_nao_aceita_privilegios_administrativos(self):
        response = self.post('/api/auth/registro/', {
            'username': 'comum', 'email': 'common@example.test',
            'password1': 'OutraSenha456!', 'password2': 'OutraSenha456!',
            'aceite_termos': True, 'ciencia_privacidade': True,
            'is_superuser': True, 'is_staff': True,
        })
        self.assertEqual(response.status_code, 201, response.data)
        user = get_user_model().objects.get(username='comum')
        self.assertFalse(user.is_superuser)
        self.assertFalse(user.is_staff)

    def test_login_rejeita_tipos_invalidos_sem_erro_interno(self):
        for payload in ([1, 2], {'email': {}, 'password': []}):
            with self.subTest(payload=payload):
                self.assertEqual(self.post('/api/auth/login/', payload).status_code, 400)

    def test_refresh_sem_barra_nao_aceita_token_pelo_corpo(self):
        for route in ('/api/auth/token/refresh', '/api/auth/token/refresh/'):
            response = self.post(route, {'refresh': 'qualquer-token'})
            self.assertEqual(response.status_code, 401)
            self.assertNotIn('access', response.data)

    def test_mudanca_de_senha_exige_senha_atual(self):
        self.client.force_authenticate(self.user)
        response = self.post('/api/auth/password/change/', {'new_password1': 'OutraSenha456!', 'new_password2': 'OutraSenha456!'})
        self.assertEqual(response.status_code, 400)
        self.assertIn('old_password', response.data)
        response = self.post('/api/auth/password/change/', {'old_password': 'SenhaTeste123!', 'new_password1': 'OutraSenha456!', 'new_password2': 'OutraSenha456!'})
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('OutraSenha456!'))

    def test_consulta_crossref_limitada_antes_de_chamar_servico(self):
        self.client.force_authenticate(self.user)
        with patch('referencias.views.pesquisar_crossref', return_value=[]) as service:
            for i in range(20):
                self.assertEqual(self.client.get(f'/api/referencias/?q=pesquisa{i}').status_code, 200)
            self.assertEqual(self.client.get('/api/referencias/?q=mais-uma').status_code, 429)
            self.assertEqual(service.call_count, 20)

    def test_troca_email_tem_contador_independente_do_uso_geral(self):
        self.client.force_authenticate(self.user)
        for _ in range(10):
            self.assertEqual(self.client.get('/api/auth/account/').status_code, 200)
        for i in range(5):
            response = self.post('/api/auth/account/email/', {
                'email': f'new{i}@example.test', 'password': 'SenhaTeste123!',
            })
            self.assertEqual(response.status_code, 200, response.data)
        response = self.post('/api/auth/account/email/', {'email': 'extra@example.test', 'password': 'SenhaTeste123!'})
        self.assertEqual(response.status_code, 429)
        self.assertEqual(self.client.get('/api/auth/account/').status_code, 200)

    def test_limite_geral_para_api(self):
        self.client.force_authenticate(self.user)
        rates = {**settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'], 'user': '2/minute'}
        with patch.object(UserRateThrottle, 'THROTTLE_RATES', rates):
            self.assertEqual(self.client.get('/api/pastas/').status_code, 200)
            self.assertEqual(self.client.get('/api/pastas/').status_code, 200)
            self.assertEqual(self.client.get('/api/pastas/').status_code, 429)

    def test_login_admin_tambem_tem_limite(self):
        self.client.get('/admin/login/')
        csrf = self.client.cookies['csrftoken'].value
        for _ in range(10):
            response = self.client.post('/admin/login/', {'username': 'inexistente', 'password': 'errada', 'csrfmiddlewaretoken': csrf})
            self.assertEqual(response.status_code, 200)
        response = self.client.post('/admin/login/', {'username': 'inexistente', 'password': 'errada', 'csrfmiddlewaretoken': csrf})
        self.assertEqual(response.status_code, 429)
