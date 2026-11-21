"""Audita o transporte configurado, sem registrar endereços, assunto ou corpo."""
from django.conf import settings
from django.core.mail import get_connection
from django.core.mail.backends.base import BaseEmailBackend

from .middleware import requisicao_atual
from .services import registrar_atividade


class EmailBackend(BaseEmailBackend):
    def __init__(self, fail_silently=False, **kwargs):
        super().__init__(fail_silently=fail_silently, **kwargs)
        self.transporte = get_connection(
            backend=settings.LOCUS_EMAIL_BACKEND, fail_silently=False, **kwargs
        )

    def open(self):
        return self.transporte.open()

    def close(self):
        return self.transporte.close()

    def registrar(self, acao, resultado='sucesso'):
        request = requisicao_atual.get()
        evento = {
            'acao': acao, 'recurso': 'email', 'resultado': resultado,
            'descricao': 'Email enviado pelo sistema.',
        }
        if request is not None:
            request._locus_email_events.append(evento)
        else:
            registrar_atividade(None, **evento)

    def send_messages(self, email_messages):
        enviados = 0
        for mensagem in email_messages or []:
            self.registrar('email_envio_tentativa')
            try:
                total = self.transporte.send_messages([mensagem]) or 0
            except Exception:
                self.registrar('email_envio_falha', 'falha')
                if not self.fail_silently:
                    raise
            else:
                enviados += total
                self.registrar(
                    'email_transporte_aceitou' if total else 'email_envio_falha',
                    'sucesso' if total else 'falha',
                )
        return enviados
