import re

from .models import RegistroAtividade

EMAIL_PATTERN = re.compile(r"[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I)


def mascarar_email(email):
    if not email or '@' not in email:
        return '—'
    nome, dominio = email.rsplit('@', 1)
    return f'{nome[:1]}***@{dominio}'


def ocultar_emails(texto):
    return EMAIL_PATTERN.sub(lambda match: mascarar_email(match.group()), str(texto or ''))

def registrar_atividade(
    request,
    acao,
    recurso,
    recurso_id=None,
    usuario=None,
    *,
    resultado='sucesso',
    descricao=''
):
    """Registra uma operação concluída sem copiar conteúdo ou credenciais."""
    if usuario is None:
        usuario = (
            request.user
            if request is not None and request.user.is_authenticated
            else None
        )

    from core.ip import obter_ip_cliente

    if request is not None:
        original = getattr(request, '_request', request)
        original._locus_audit_logged = True
    return RegistroAtividade.objects.create(
        acao=acao,
        recurso=recurso,
        recurso_id=recurso_id,
        usuario=usuario,
        resultado=resultado,
        endereco_ip=obter_ip_cliente(request) if request is not None else None,
        user_agent=(
            ocultar_emails(request.META.get('HTTP_USER_AGENT', ''))[:500] if request is not None else ''
        ),
        descricao=ocultar_emails(descricao)[:500],
    )
