"""Confirmação do endereço atual antes do acesso administrativo pela API."""
import hashlib

from allauth.account.models import EmailAddress
from django.core.cache import cache
from django.core.validators import validate_email

from auditoria.services import registrar_atividade


def email_confirmado(usuario):
    return EmailAddress.objects.filter(
        user=usuario, email__iexact=usuario.email, verified=True
    ).exists()


def solicitar_confirmacao_admin(request, usuario):
    email = usuario.email.strip().lower()
    chave = f'admin-confirmacao:{usuario.pk}:{hashlib.sha256(email.encode()).hexdigest()}'
    reservada = False
    try:
        validate_email(email)
        endereco, _ = EmailAddress.objects.get_or_create(
            user=usuario, email=email,
            defaults={
                'verified': False,
                'primary': not EmailAddress.objects.filter(user=usuario, primary=True).exists(),
            },
        )
        if endereco.verified:
            return False
        # Mesmo limite para o login e o botão de reenvio.
        reservada = cache.add(chave, True, timeout=60)
        if not reservada:
            return False
        endereco.send_confirmation(request, signup=False)
    except Exception:
        if reservada:
            cache.delete(chave)
        registrar_atividade(
            request, 'admin_confirmacao_envio_falha', 'conta', usuario.pk,
            resultado='falha', descricao='Não foi possível solicitar a confirmação de e-mail.',
        )
        raise
    registrar_atividade(
        request, 'admin_confirmacao_solicitada', 'conta', usuario.pk,
        descricao='Confirmação encaminhada ao transporte de e-mail; entrega não comprovada.',
    )
    return True
