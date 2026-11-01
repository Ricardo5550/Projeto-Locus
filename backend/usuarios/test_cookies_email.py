import re
from datetime import timedelta
from unittest.mock import Mock, patch
from urllib.parse import urlparse, parse_qs

from allauth.account.models import EmailAddress
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from .models import AlteracaoEmail


@override_settings(RECAPTCHA_SECRET_KEY='teste', JWT_COOKIE_SECURE=False)
class CookieEmailTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user=get_user_model().objects.create_user('conta','antigo@example.test','SenhaTeste123!')
        EmailAddress.objects.create(user=self.user,email=self.user.email,primary=True,verified=True)
        self.client=APIClient(enforce_csrf_checks=True)
        self.csrf=self.client.get('/api/auth/csrf/').data['csrf_token']

    def post(self,path,data=None,csrf=True,**kwargs):
        return self.client.post(path,data or {},format='json',**({'HTTP_X_CSRFTOKEN':self.csrf} if csrf else {}),**kwargs)

    def login(self):
        with patch('usuarios.views.requests.post') as google:
            google.return_value.json.return_value={'success':True}
            response=self.post('/api/auth/login/',{'email':self.user.email,'password':'SenhaTeste123!','captcha_token':'ok'})
        self.assertEqual(response.status_code,200,response.data)
        self.csrf=response.data['csrf_token']
        return response

    def request_change(self,email='novo@example.test'):
        return self.post('/api/auth/account/email/',{'email':email,'password':'SenhaTeste123!'})

    def token(self):
        link=re.search(r'https?://[^\s]+',mail.outbox[-1].body).group()
        return parse_qs(urlparse(link).query)['token'][0]

    def test_login_define_cookies_http_only_sem_tokens_no_json(self):
        response=self.login()
        self.assertNotIn('access',response.data);self.assertNotIn('refresh',response.data)
        for name,path in [('locus_access','/api/'),('locus_refresh','/api/auth/')]:
            self.assertTrue(response.cookies[name]['httponly'])
            self.assertEqual(response.cookies[name]['samesite'],'Lax')
            self.assertEqual(response.cookies[name]['path'],path)
        self.assertEqual(self.client.get('/api/auth/account/').status_code,200)

    def test_login_recusa_csrf_ausente(self):
        response=self.post('/api/auth/login/',{'email':self.user.email,'password':'SenhaTeste123!','captcha_token':'ok'},csrf=False)
        self.assertEqual(response.status_code,403)

    def test_mutacao_recusa_csrf_ausente_e_origem_alheia(self):
        self.login()
        self.assertEqual(self.post('/api/pastas/',{'nome':'Pasta'},csrf=False).status_code,403)
        self.assertEqual(self.post('/api/pastas/',{'nome':'Pasta'},HTTP_ORIGIN='https://intruso.example').status_code,403)
        self.assertEqual(self.post('/api/pastas/',{'nome':'Pasta'},HTTP_ORIGIN='http://localhost:5173').status_code,201)

    def test_bearer_nao_substitui_cookie(self):
        token=RefreshToken.for_user(self.user)
        other=APIClient();other.credentials(HTTP_AUTHORIZATION=f'Bearer {token.access_token}')
        self.assertEqual(other.get('/api/auth/account/').status_code,401)

    def test_renovacao_rotaciona_e_invalida_refresh_antigo(self):
        self.login();old=self.client.cookies['locus_refresh'].value
        response=self.post('/api/auth/token/refresh/')
        self.assertEqual(response.status_code,200)
        self.assertNotIn('access',response.data)
        self.assertNotEqual(old,self.client.cookies['locus_refresh'].value)
        self.client.cookies['locus_refresh']=old
        self.assertEqual(self.post('/api/auth/token/refresh/').status_code,401)

    def test_refresh_invalido_limpa_cookies(self):
        self.client.cookies['locus_refresh']='invalido'
        response=self.post('/api/auth/token/refresh/')
        self.assertEqual(response.status_code,401)
        self.assertEqual(response.cookies['locus_refresh']['max-age'],0)

    def test_logout_invalida_refresh_e_limpa_cookies(self):
        self.login();old=self.client.cookies['locus_refresh'].value
        response=self.post('/api/auth/logout/')
        self.assertEqual(response.status_code,204)
        self.assertEqual(response.cookies['locus_access']['max-age'],0)
        self.client.cookies['locus_refresh']=old
        self.assertEqual(self.post('/api/auth/token/refresh/').status_code,401)

    def test_senha_alterada_invalida_access_e_refresh(self):
        self.login();self.user.set_password('OutraSenha456!');self.user.save()
        self.assertEqual(self.client.get('/api/auth/account/').status_code,401)
        self.assertEqual(self.post('/api/auth/token/refresh/').status_code,401)

    @override_settings(JWT_COOKIE_SECURE=True)
    def test_cookies_seguros_em_https(self):
        response=self.login()
        self.assertTrue(response.cookies['locus_access']['secure'])
        self.assertTrue(response.cookies['locus_refresh']['secure'])

    def test_email_atual_permanece_ate_confirmacao_e_revoga_sessoes(self):
        self.login();access=self.client.cookies['locus_access'].value
        refresh=self.client.cookies['locus_refresh'].value
        response=self.request_change()
        self.assertEqual(response.status_code,200,response.data)
        self.user.refresh_from_db();self.assertEqual(self.user.email,'antigo@example.test')
        token=self.token()
        self.assertIn('novo@example.test',[p.email for p in AlteracaoEmail.objects.all()])
        self.assertEqual(self.client.get('/api/auth/account/').data['pending_email'],'novo@example.test')
        response=self.post('/api/auth/account/email/confirm/',{'token':token})
        self.assertEqual(response.status_code,200,response.data)
        self.user.refresh_from_db();self.assertEqual(self.user.email,'novo@example.test')
        self.assertFalse(EmailAddress.objects.filter(email='antigo@example.test').exists())
        self.assertTrue(EmailAddress.objects.get(email='novo@example.test').verified)
        self.client.cookies['locus_access']=access;self.client.cookies['locus_refresh']=refresh
        self.assertEqual(self.client.get('/api/auth/account/').status_code,401)
        self.assertEqual(self.post('/api/auth/token/refresh/').status_code,401)
        self.assertEqual(self.post('/api/auth/account/email/confirm/',{'token':token}).status_code,400)

    def test_email_exige_senha_e_recusa_endereco_em_uso(self):
        self.login()
        self.assertEqual(self.post('/api/auth/account/email/',{'email':'novo@example.test','password':'errada'}).status_code,400)
        get_user_model().objects.create_user('outro','ocupado@example.test','senha')
        self.assertEqual(self.request_change('ocupado@example.test').status_code,400)
        self.assertEqual(len(getattr(mail,'outbox',[])),0)

    def test_link_anterior_deixa_de_valer_apos_nova_solicitacao(self):
        self.login();self.assertEqual(self.request_change().status_code,200);old=self.token()
        self.assertEqual(self.request_change('outro@example.test').status_code,200)
        self.assertEqual(self.post('/api/auth/account/email/confirm/',{'token':old}).status_code,400)
        self.assertEqual(self.post('/api/auth/account/email/confirm/',{'token':self.token()}).status_code,200)

    def test_link_expirado_e_token_alterado_nao_mudam_email(self):
        self.login();self.request_change();token=self.token()
        self.assertEqual(self.post('/api/auth/account/email/confirm/',{'token':token+'x'}).status_code,400)
        with patch('django.core.signing.time.time',return_value=timezone.now().timestamp()+settings.EMAIL_CHANGE_MAX_AGE+10):
            self.assertEqual(self.post('/api/auth/account/email/confirm/',{'token':token}).status_code,400)
        self.user.refresh_from_db();self.assertEqual(self.user.email,'antigo@example.test')

    def test_falha_de_envio_preserva_email_e_reverte_solicitacao(self):
        self.login()
        with patch('usuarios.email_views.send_mail',side_effect=RuntimeError('SMTP indisponível')):
            response=self.request_change()
        self.assertEqual(response.status_code,503)
        self.assertFalse(AlteracaoEmail.objects.exists())
        self.user.refresh_from_db();self.assertEqual(self.user.email,'antigo@example.test')

    def test_confirmacao_exige_csrf(self):
        self.login();self.request_change()
        self.assertEqual(self.post('/api/auth/account/email/confirm/',{'token':self.token()},csrf=False).status_code,403)

    def test_conta_excluida_nao_confirma_troca_email(self):
        self.login();self.request_change();token=self.token()
        self.user.is_active=False;self.user.save(update_fields=['is_active'])
        self.assertEqual(self.post('/api/auth/account/email/confirm/',{'token':token}).status_code,400)

    def test_cadastro_publico_exige_csrf(self):
        response=self.post('/api/auth/registro/',{'username':'novo'},csrf=False)
        self.assertEqual(response.status_code,403)
