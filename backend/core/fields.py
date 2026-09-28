from django.db import models

from .crypto import decrypt_text, deserialize_json, encrypt_text, serialize_json


class EncryptedTextField(models.TextField):
    """TextField criptografado no banco e transparente para o código Python."""

    def from_db_value(self, value, expression, connection):
        if value is None:
            return value
        return decrypt_text(value)

    def to_python(self, value):
        if value is None or isinstance(value, str):
            return value
        return str(value)

    def get_prep_value(self, value):
        if value is None:
            return None
        return encrypt_text(str(value))


class EncryptedJSONField(models.TextField):
    """Armazena JSON como texto criptografado e devolve dict/list em Python."""

    def from_db_value(self, value, expression, connection):
        if value is None or isinstance(value, (dict, list, int, float, bool)):
            return value

        plain = decrypt_text(value)
        try:
            return deserialize_json(plain)
        except (TypeError, ValueError):
            # Compatibilidade defensiva com registros legados inesperados.
            return plain

    def to_python(self, value):
        if value is None or isinstance(value, (dict, list, int, float, bool)):
            return value

        if isinstance(value, str):
            try:
                return deserialize_json(value)
            except (TypeError, ValueError):
                return value

        return value

    def get_prep_value(self, value):
        if value is None:
            return None
        return encrypt_text(serialize_json(value))
