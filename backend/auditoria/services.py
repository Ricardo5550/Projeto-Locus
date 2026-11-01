from .models import RegistroAtividade


def registrar_atividade(request, acao, recurso, recurso_id=None, usuario=None, *, resultado='sucesso', descricao=''):
    """Registra uma operação concluída sem copiar conteúdo ou credenciais."""
    if usuario is None:
        usuario = request.user if request is not None and request.user.is_authenticated else None

    from core.ip import obter_ip_cliente

    return RegistroAtividade.objects.create(
        acao=acao,
        recurso=recurso,
        recurso_id=recurso_id,
        usuario=usuario,
        resultado=resultado,
        endereco_ip=obter_ip_cliente(request) if request is not None else None,
        user_agent=(request.META.get('HTTP_USER_AGENT', '')[:500] if request is not None else ''),
        descricao=descricao[:500],
    )
