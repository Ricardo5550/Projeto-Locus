"""Limite adicional de login por combinação de endereço de rede e e-mail."""
from hashlib import sha256

from rest_framework.throttling import SimpleRateThrottle, UserRateThrottle


class ReferenceThrottle(UserRateThrottle):
    scope = 'references'


class AdminLoginThrottle(SimpleRateThrottle):
    scope = 'admin_login'

    def get_cache_key(self, request, view):
        return self.cache_format % {'scope': self.scope, 'ident': self.get_ident(request)}


class LoginPairThrottle(SimpleRateThrottle):
    scope = 'login_pair'

    def get_cache_key(self, request, view):
        data = request.data
        email = data.get('email', '') if isinstance(data, dict) else ''
        if not isinstance(email, str):
            email = ''
        identity = self.get_ident(request) + ':' + email.strip().casefold()[:254]
        return self.cache_format % {
            'scope': self.scope,
            'ident': sha256(identity.encode()).hexdigest(),
        }
