"""Auditoria complementar de operações e contexto para o envio de e-mails."""
from contextvars import ContextVar
from uuid import UUID

from .services import registrar_atividade

requisicao_atual = ContextVar('locus_requisicao_auditoria', default=None)


class AuditoriaMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        token = requisicao_atual.set(request)
        request._locus_email_events = []
        try:
            response = self.get_response(request)
            match = request.resolver_match
            if (
                request.method not in ('GET', 'HEAD', 'OPTIONS')
                and request.path.startswith(('/api/', '/gestao/'))
                and (response.status_code >= 400 or not getattr(request, '_locus_audit_logged', False))
            ):
                nome = (match.url_name or 'operacao') if match else 'operacao'
                recurso_id = None
                if match:
                    for valor in match.kwargs.values():
                        try:
                            recurso_id = UUID(str(valor))
                            break
                        except (ValueError, TypeError):
                            pass
                registrar_atividade(
                    request, nome[:64], 'sistema', recurso_id,
                    resultado='sucesso' if response.status_code < 400 else (
                        'bloqueado' if response.status_code in (401, 403, 429) else 'falha'
                    ),
                    descricao=f'{request.method} · HTTP {response.status_code}',
                )
            # Executado fora das transações da view, inclusive se o envio falhou.
            for evento in request._locus_email_events:
                registrar_atividade(request, **evento)
            return response
        finally:
            requisicao_atual.reset(token)
