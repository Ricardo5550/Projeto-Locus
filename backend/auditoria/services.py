from .models import RegistroAtividade


def registrar_atividade(request, acao, recurso, recurso_id, usuario=None):
    """Registra uma operação concluída sem copiar conteúdo ou credenciais."""
    if usuario is None:
        usuario = request.user if request.user.is_authenticated else None

    return RegistroAtividade.objects.create(
        acao=acao,
        recurso=recurso,
        recurso_id=recurso_id,
        usuario=usuario,
    )
