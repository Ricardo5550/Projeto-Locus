"""Gestão da equipe e encerramento administrativo, com bloqueio compartilhado."""
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.utils import timezone
from allauth.account.models import EmailAddress

from auditoria.services import registrar_atividade, ocultar_emails


CAMPOS_ACESSO = {'is_active', 'is_staff', 'is_superuser'}
ACOES_EQUIPE = {
    'promover_supremo': 'Promover a administrador supremo',
    'rebaixar_admin': 'Retirar privilégio de supremo',
    'concluir_encerramento': 'Concluir encerramento solicitado',
}


def bloquear_equipe():
    # Deve ser chamado dentro de atomic, ANTES de bloquear contas individuais.
    from .models import ControleAdministracao
    ControleAdministracao.objects.get_or_create(pk=1)
    ControleAdministracao.objects.select_for_update().get(pk=1)


def supremos_ativos():
    return get_user_model().objects.filter(is_active=True, is_staff=True, is_superuser=True)


def impedir_perda_ultimo(queryset, alteracoes):
    if not CAMPOS_ACESSO.intersection(alteracoes):
        return
    if any(type(valor) is not bool for campo, valor in alteracoes.items() if campo in CAMPOS_ACESSO):
        raise ValidationError('Altere as permissões por uma operação individual de gestão.')
    if any(alteracoes.get(campo) is False for campo in CAMPOS_ACESSO):
        afetados = queryset.filter(is_active=True, is_staff=True, is_superuser=True).count()
        if afetados and supremos_ativos().count() <= afetados:
            raise ValidationError('O último administrador supremo ativo não pode ser suspenso, encerrado ou rebaixado. Configure outro supremo ativo primeiro.')


def conferir_supremo(request, senha=None):
    ator = get_user_model().objects.select_for_update().get(pk=request.user.pk)
    if not (ator.is_active and ator.is_staff and ator.is_superuser):
        raise PermissionDenied('Somente um administrador supremo pode gerenciar a equipe.')
    if senha is not None and not ator.check_password(senha):
        raise ValidationError('Senha atual do administrador inválida.')
    return ator


def exigir_gestao_conta(request, usuario):
    if not (request.user.is_active and request.user.is_staff):
        raise PermissionDenied
    if (usuario.is_staff or usuario.is_superuser) and not request.user.is_superuser:
        raise PermissionDenied('Administradores comuns não gerenciam outras contas administrativas.')


def validar_motivo(motivo):
    motivo = str(motivo or '').strip()
    if not 5 <= len(motivo) <= 300:
        raise ValidationError('Informe um motivo entre 5 e 300 caracteres.')
    return ocultar_emails(motivo)


@transaction.atomic
def criar_administrador(request, username, email, password, senha_atual):
    bloquear_equipe()
    conferir_supremo(request, senha_atual)
    User = get_user_model()
    usuario = User(username=username, email=User.objects.normalize_email(email), is_staff=True, is_superuser=False)
    usuario.full_clean(exclude=['password'])
    if User.objects.filter(username__iexact=username).exists():
        raise ValidationError({'username': 'Já existe uma conta com este nome.'})
    if User.objects.filter(email__iexact=email).exists() or EmailAddress.objects.filter(email__iexact=email).exists():
        raise ValidationError({'email': 'Já existe uma conta com este e-mail.'})
    validate_password(password, usuario)
    usuario.set_password(password)
    usuario.save()
    EmailAddress.objects.create(user=usuario, email=usuario.email, primary=True, verified=False)
    registrar_atividade(
        request, 'admin_cadastrado', 'conta', usuario.pk,
        descricao='Cadastro de administrador comum.',
    )
    return usuario


@transaction.atomic
def gerir_equipe(request, usuario_id, acao, motivo, senha_atual):
    from .models import SolicitacaoEncerramentoAdmin
    from .mfa import revogar_sessoes
    bloquear_equipe()
    ator = conferir_supremo(request, senha_atual)
    usuario = get_user_model().objects.select_for_update().get(pk=usuario_id)
    if usuario.pk == ator.pk:
        raise PermissionDenied('Esta operação deve ser concluída por outro administrador supremo.')
    if not usuario.is_staff:
        raise ValidationError('Escolha uma conta administrativa.')
    motivo = validar_motivo(motivo)
    if acao == 'promover_supremo':
        if not usuario.is_active:
            raise ValidationError('Reative a conta antes de conceder o privilégio de supremo.')
        usuario.is_superuser = True
        usuario.save(update_fields=['is_superuser'])
    elif acao == 'rebaixar_admin':
        usuario.is_superuser = False
        usuario.save(update_fields=['is_superuser'])
    elif acao == 'concluir_encerramento':
        pedido = SolicitacaoEncerramentoAdmin.objects.select_for_update().filter(usuario=usuario, concluida_em__isnull=True).first()
        if pedido is None:
            raise ValidationError('Esta conta não possui pedido de encerramento pendente.')
        impedir_perda_ultimo(get_user_model().objects.filter(pk=usuario.pk), {'is_active': False})
        from .services import anonimizar_e_desativar_conta
        anonimizar_e_desativar_conta(usuario, encerramento_controlado=True)
        pedido.concluida_em = timezone.now()
        pedido.concluida_por = ator
        pedido.motivo_conclusao = motivo
        pedido.save(update_fields=['concluida_em', 'concluida_por', 'motivo_conclusao'])
    else:
        raise ValidationError('Ação de equipe inválida.')
    revogar_sessoes(usuario)
    registrar_atividade(request, 'admin_' + acao, 'conta', usuario.pk, descricao=motivo)


@transaction.atomic
def solicitar_encerramento(request, senha, motivo):
    from .models import SolicitacaoEncerramentoAdmin
    from .mfa import revogar_sessoes
    bloquear_equipe()
    usuario = get_user_model().objects.select_for_update().get(pk=request.user.pk)
    if not (usuario.is_active and usuario.is_staff):
        raise PermissionDenied('Este procedimento é exclusivo de contas administrativas.')
    if not usuario.check_password(senha):
        raise ValidationError('Senha atual inválida.')
    motivo = validar_motivo(motivo)
    pedido, criado = SolicitacaoEncerramentoAdmin.objects.get_or_create(
        usuario=usuario, concluida_em__isnull=True, defaults={'motivo': motivo},
    )
    if criado:
        registrar_atividade(request, 'admin_encerramento_solicitado', 'conta', usuario.pk, descricao=motivo)
    # O acesso definitivo só é desativado na conclusão controlada. O último
    # supremo pode entrar novamente para transferir a responsabilidade.
    revogar_sessoes(usuario)
    return pedido
