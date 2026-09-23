from .models import RegistroAtividade


def registrar_atividade(request, acao, recurso, recurso_id):
    """Registra uma operação concluída, sem copiar conteúdo ou credenciais."""
    usuario = request.user if request.user.is_authenticated else None
    return RegistroAtividade.objects.create(
        acao=acao,
        recurso=recurso,
        recurso_id=recurso_id,
        usuario=usuario,
    )
