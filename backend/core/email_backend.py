"""Envia os e-mails do Django pela API HTTPS do Brevo."""

from email.utils import parseaddr

import requests
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.core.mail.backends.base import BaseEmailBackend
from django.core.validators import validate_email


class BrevoEmailBackend(BaseEmailBackend):
    """Transporte usado pelo backend de auditoria já existente no Locus."""

    def send_messages(self, email_messages):
        enviados = 0
        for mensagem in email_messages or []:
            if not mensagem.recipients():
                continue
            try:
                self.enviar(mensagem)
            except Exception:
                if not self.fail_silently:
                    raise
            else:
                enviados += 1
        return enviados

    def enviar(self, mensagem):
        chave = settings.BREVO_API_KEY.strip()
        if not chave:
            raise ImproperlyConfigured('Configure BREVO_API_KEY para enviar pelo Brevo.')

        # Mantém a validação de cabeçalhos do Django antes de chamar a API.
        mensagem.message()
        if mensagem.attachments:
            raise ValueError('O transporte do Locus não envia anexos por e-mail.')
        if len(mensagem.reply_to) > 1:
            raise ValueError('Informe somente um endereço de resposta.')

        dados = {
            'sender': self.endereco(mensagem.from_email),
            'subject': mensagem.subject,
            'htmlContent' if mensagem.content_subtype == 'html' else 'textContent': mensagem.body,
        }
        for campo in ('to', 'cc', 'bcc'):
            enderecos = getattr(mensagem, campo)
            if enderecos:
                dados[campo] = [self.endereco(endereco) for endereco in enderecos]
        if mensagem.reply_to:
            dados['replyTo'] = self.endereco(mensagem.reply_to[0])
        if mensagem.extra_headers:
            dados['headers'] = mensagem.extra_headers
        for conteudo, tipo in getattr(mensagem, 'alternatives', []):
            if tipo != 'text/html':
                raise ValueError('Alternativa de e-mail não suportada pelo Locus.')
            dados['htmlContent'] = conteudo

        try:
            resposta = requests.post(
                'https://api.brevo.com/v3/smtp/email',
                headers={'api-key': chave, 'Accept': 'application/json'},
                json=dados,
                timeout=settings.EMAIL_TIMEOUT,
                allow_redirects=False,
            )
        except requests.RequestException:
            # Não expõe a chave, os destinatários ou o corpo na exceção.
            raise RuntimeError('Não foi possível conectar ao serviço de e-mail Brevo.') from None
        try:
            if resposta.status_code != 201:
                raise RuntimeError(
                    f'Brevo recusou o envio (HTTP {resposta.status_code}). '
                    'Confira a configuração e os registros no painel do Brevo.'
                )
        finally:
            resposta.close()

    @staticmethod
    def endereco(valor):
        nome, email = parseaddr(valor)
        validate_email(email)
        return {'email': email, **({'name': nome} if nome else {})}
