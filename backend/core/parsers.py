import json
from rest_framework.exceptions import ParseError
from rest_framework.parsers import JSONParser


class LimitedJSONParser(JSONParser):
    """Limita bytes e profundidade antes de chamar o decodificador JSON."""
    def parse(self, stream, media_type=None, parser_context=None):
        raw = stream.read(10 * 1024 * 1024 + 1)
        if len(raw) > 10 * 1024 * 1024:
            raise ParseError('O envio excede o limite de 10 MB.')
        depth = 0
        quoted = escaped = False
        for char in raw:
            if quoted:
                if escaped:
                    escaped = False
                elif char == 92:
                    escaped = True
                elif char == 34:
                    quoted = False
            elif char == 34:
                quoted = True
            elif char in (123, 91):
                depth += 1
                if depth > 64:
                    raise ParseError('JSON excede a profundidade permitida.')
            elif char in (125, 93):
                depth -= 1
        def invalid_constant(value):
            raise ValueError(value)
        try:
            value = json.loads(raw.decode('utf-8'), parse_constant=invalid_constant)
            if not isinstance(value, dict):
                raise ParseError('Envie um objeto JSON como corpo da requisição.')
            return value
        except (ValueError, UnicodeError, RecursionError) as exc:
            raise ParseError('JSON inválido.') from exc
