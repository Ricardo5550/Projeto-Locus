"""Configuração isolada para testes locais; não usa o PostgreSQL da aplicação."""
from .settings import *  # noqa: F403

DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}}
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
DATA_ENCRYPTION_KEY = 'MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA='
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']
DEBUG = True
SECURE_SSL_REDIRECT = False
ALLOWED_HOSTS = ['testserver', 'localhost', '127.0.0.1']
