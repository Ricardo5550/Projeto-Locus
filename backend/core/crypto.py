import json

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

_PREFIX = 'enc:v1:'


def _fernet() -> Fernet:
    key = getattr(settings, 'DATA_ENCRYPTION_KEY', None)
    if not key:
        raise ImproperlyConfigured(
            'DATA_ENCRYPTION_KEY não foi configurada. Gere uma chave Fernet e adicione-a ao .env.'
        )

    try:
        return Fernet(key.encode() if isinstance(key, str) else key)
    except (TypeError, ValueError) as exc:
        raise ImproperlyConfigured('DATA_ENCRYPTION_KEY inválida.') from exc


def encrypt_text(value: str) -> str:
    if value is None:
        return value
    token = _fernet().encrypt(value.encode('utf-8')).decode('ascii')
    return f'{_PREFIX}{token}'


def decrypt_text(value: str) -> str:
    if value is None or not isinstance(value, str):
        return value

    # Compatibilidade com registros antigos ainda em texto puro.
    if not value.startswith(_PREFIX):
        return value

    token = value[len(_PREFIX):]
    try:
        return _fernet().decrypt(token.encode('ascii')).decode('utf-8')
    except (InvalidToken, ValueError, TypeError) as exc:
        raise ImproperlyConfigured(
            'Não foi possível descriptografar um dado. Verifique DATA_ENCRYPTION_KEY.'
        ) from exc


def serialize_json(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))


def deserialize_json(value: str):
    return json.loads(value)
