from django.http import HttpResponse
from .throttling import AdminLoginThrottle


class AdminLoginRateLimitMiddleware:
    """Aplica o limite também ao login HTML do Django Admin."""
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if response.status_code == 429 and request.path.startswith(('/api/auth/', '/admin/')):
            from django.core.cache import cache
            from hashlib import sha256
            from .ip import obter_ip_cliente
            from auditoria.services import registrar_atividade
            key = sha256((str(obter_ip_cliente(request)) + request.path).encode()).hexdigest()
            if cache.add('audit.rate.' + key, True, timeout=60):
                registrar_atividade(request, 'limite_requisicoes', 'conta', resultado='bloqueado', descricao='Limite de requisições atingido.')
        return response

    def process_view(self, request, view_func, view_args, view_kwargs):
        match = request.resolver_match
        if request.method == 'POST' and match and match.namespace == 'admin' and match.url_name == 'login':
            throttle = AdminLoginThrottle()
            if not throttle.allow_request(request, None):
                response = HttpResponse('Muitas tentativas. Aguarde um minuto e tente novamente.', status=429)
                response['Retry-After'] = str(max(1, int(throttle.wait() or 60)))
                return response
