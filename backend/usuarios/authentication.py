from django.conf import settings
from rest_framework.authentication import SessionAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.authentication import JWTAuthentication
from .models import EstadoAutenticacao


def exigir_csrf(request):
    if request.method not in ('GET', 'HEAD', 'OPTIONS', 'TRACE'):
        SessionAuthentication().enforce_csrf(request)


def versao_sessao(usuario):
    return EstadoAutenticacao.objects.filter(usuario=usuario).values_list('versao', flat=True).first() or 0


class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        # DRF não aplica CSRF automaticamente em autenticação JWT.
        exigir_csrf(request)
        raw = request.COOKIES.get(settings.JWT_ACCESS_COOKIE)
        if not raw:
            return None
        try:
            token = self.get_validated_token(raw)
            user = self.get_user(token)
            if token.get('session_version') != versao_sessao(user):
                raise AuthenticationFailed('A sessão foi encerrada. Entre novamente.')
            from .mfa import exigir_segundo_fator
            if exigir_segundo_fator(user) and token.get('mfa_verified') is not True:
                raise AuthenticationFailed('Entre novamente para validar o segundo fator.')
            return user, token
        except AuthenticationFailed:
            view = (request.parser_context or {}).get('view')
            if view and AllowAny in view.permission_classes:
                return None
            raise
