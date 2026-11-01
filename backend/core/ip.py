from ipaddress import ip_address
from rest_framework.throttling import BaseThrottle


def obter_ip_cliente(request):
    """A mesma cadeia de proxies usada pelo limitador; cabeçalho não confiável é ignorado."""
    try:
        return str(ip_address(BaseThrottle().get_ident(request)))
    except (ValueError, TypeError):
        return None
