"""Configurações principais do projeto Django Locus."""

from datetime import timedelta
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'
if DEBUG:
    SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-development-only-change-me')
else:
    SECRET_KEY = os.environ['SECRET_KEY']
    if len(SECRET_KEY) < 50 or SECRET_KEY.startswith('django-insecure-'):
        raise ValueError('Configure uma SECRET_KEY aleatória com pelo menos 50 caracteres para produção.')
ALLOWED_HOSTS = [
    host.strip()
    for host in os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')
    if host.strip()
]

FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173').rstrip('/')

INSTALLED_APPS = [
    'notificacoes',
    'usuarios.admin_apps.LocusAdminConfig',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.sites',
    'rest_framework',
    'rest_framework.authtoken',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'dj_rest_auth',
    'dj_rest_auth.registration',
    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    'pastas',
    'anotacoes',
    'mapas',
    'usuarios',
    'auditoria',
    'referencias',
    'revisoes',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'core.middleware.AdminLoginRateLimitMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'allauth.account.middleware.AccountMiddleware',
]

ROOT_URLCONF = 'locus.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'locus.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME'),
        'USER': os.getenv('DB_USER'),
        'PASSWORD': os.getenv('DB_PASSWORD'),
        'HOST': os.getenv('DB_HOST', 'localhost'),
        'PORT': os.getenv('DB_PORT', '5432'),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {'min_length': 7},
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

LANGUAGE_CODE = 'pt-br'
TIME_ZONE = 'America/Sao_Paulo'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        'CORS_ALLOWED_ORIGINS',
        'http://localhost:5173,http://127.0.0.1:5173',
    ).split(',')
    if origin.strip()
]

REST_FRAMEWORK = {
    'DEFAULT_THROTTLE_CLASSES': (
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
        'rest_framework.throttling.ScopedRateThrottle',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'anon': '60/minute',
        'user': '180/minute',
        'login': '10/minute',
        'login_pair': '5/minute',
        'admin_login': '10/minute',
        'registration': '5/hour',
        'password_reset': '5/hour',
        'password_confirm': '10/hour',
        'password_change': '5/hour',
        'email_verify': '20/hour',
        'email_resend': '5/hour',
        'email_confirm': '20/hour',
        'refresh': '30/minute',
        'references': '20/minute',
        'mfa_verify': '20/minute',
        'mfa_setup': '10/minute',
        'mfa_manage': '10/minute',
    },
    # Não confie em X-Forwarded-For por padrão. Ajuste somente após conhecer
    # a cadeia de proxies da hospedagem (ver guia).
    'NUM_PROXIES': int(os.getenv('TRUSTED_PROXY_COUNT', '0')),
    'DEFAULT_PARSER_CLASSES': ('core.parsers.LimitedJSONParser',),
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'usuarios.authentication.CookieJWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=5),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'CHECK_REVOKE_TOKEN': True,
}

RECAPTCHA_SECRET_KEY = os.getenv('RECAPTCHA_SECRET_KEY')
DATA_ENCRYPTION_KEY = os.getenv('DATA_ENCRYPTION_KEY')

SITE_ID = 1
ACCOUNT_LOGIN_METHODS = {'email'}
ACCOUNT_UNIQUE_EMAIL = True
ACCOUNT_SIGNUP_FIELDS = ['username*', 'email*', 'password1*', 'password2*']
ACCOUNT_EMAIL_VERIFICATION = 'mandatory'
ACCOUNT_EMAIL_CONFIRMATION_EXPIRE_DAYS = 3

EMAIL_BACKEND = os.getenv(
    'EMAIL_BACKEND',
    'django.core.mail.backends.console.EmailBackend' if DEBUG
    else 'django.core.mail.backends.smtp.EmailBackend',
)
EMAIL_HOST = os.getenv('EMAIL_HOST', '')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', '587'))
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'True').lower() == 'true'
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', EMAIL_HOST_USER or 'no-reply@locus.local')

REST_AUTH = {
    'USE_JWT': True,
    'REGISTER_SERIALIZER': 'usuarios.serializers.LocusRegisterSerializer',
    'SESSION_LOGIN': False,
    'OLD_PASSWORD_FIELD_ENABLED': True,
}

AUTHENTICATION_BACKENDS = [
    'django.contrib.auth.backends.ModelBackend',
    'allauth.account.auth_backends.AuthenticationBackend',
]

# Em produção, habilite via variáveis de ambiente e proxy HTTPS.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True


# Cookies da API. Em produção, use HTTPS e mantenha Secure habilitado.
JWT_ACCESS_COOKIE = 'locus_access'
JWT_REFRESH_COOKIE = 'locus_refresh'
JWT_COOKIE_SECURE = not DEBUG
JWT_COOKIE_SAMESITE = os.getenv('JWT_COOKIE_SAMESITE', 'Lax')
if JWT_COOKIE_SAMESITE not in ('Lax', 'Strict', 'None'):
    raise ValueError('JWT_COOKIE_SAMESITE deve ser Lax, Strict ou None.')
if JWT_COOKIE_SAMESITE == 'None' and not JWT_COOKIE_SECURE:
    raise ValueError('SameSite=None exige HTTPS e DEBUG=False.')
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SECURE = JWT_COOKIE_SECURE
CSRF_COOKIE_SAMESITE = JWT_COOKIE_SAMESITE
EMAIL_CHANGE_MAX_AGE = 86400
# Limite para o corpo antes do processamento dos documentos JSON (imagens incluídas).
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024

# Cache compartilhado entre os processos de produção, sem dependência extra.
# Antes de iniciar em produção: python manage.py createcachetable
CACHES = {'default': {
    'BACKEND': ('django.core.cache.backends.locmem.LocMemCache' if DEBUG
                else 'django.core.cache.backends.db.DatabaseCache'),
    'LOCATION': 'locus_rate_cache',
    'OPTIONS': {'MAX_ENTRIES': 20000},
}}
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'same-origin'
X_FRAME_OPTIONS = 'DENY'
