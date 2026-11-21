"""Ações de suporte compartilhadas pelos painéis administrativos."""
from allauth.account.models import EmailAddress
from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from dj_rest_auth.serializers import PasswordResetSerializer

from auditoria.services import registrar_atividade, ocultar_emails
from django.utils import timezone
from uuid import uuid4
from notificacoes.models import Notificacao
from .mfa import revogar_sessoes

ACOES = {
    'reenviar_confirmacao': 'Reenviar confirmação de e-mail',
    'enviar_recuperacao': 'Enviar recuperação de senha',
    'suspender': 'Suspender acesso',
    'reativar': 'Reativar conta suspensa',
    'encerrar_sessoes': 'Encerrar sessões',
}


def atender_conta(request, usuario_id, acao, motivo):
    if acao not in ACOES:
        raise ValidationError('Ação inválida.')
    if not request.user.is_staff or not request.user.is_active:
        raise PermissionDenied
    try:
        with transaction.atomic():
            from .equipe import bloquear_equipe
            bloquear_equipe()
            ator = get_user_model().objects.select_for_update().get(pk=request.user.pk)
            if not (ator.is_active and ator.is_staff):
                raise PermissionDenied
            request.user = ator
            usuario = get_user_model().objects.select_for_update().get(pk=usuario_id)
            if usuario.pk == request.user.pk or (
                not request.user.is_superuser and (usuario.is_staff or usuario.is_superuser)
            ):
                raise PermissionDenied('Esta conta não pode ser alterada neste atendimento.')
            if acao == 'reenviar_confirmacao':
                endereco = EmailAddress.objects.filter(
                    user=usuario, email__iexact=usuario.email, verified=False
                ).first()
                if not endereco or not usuario.is_active:
                    raise ValidationError('Conta inativa ou e-mail já confirmado.')
                endereco.send_confirmation(request, signup=False)
            elif acao == 'enviar_recuperacao':
                if not usuario.is_active:
                    raise ValidationError('A conta está inativa.')
                dados = PasswordResetSerializer(
                    data={'email': usuario.email}, context={'request': request}
                )
                dados.is_valid(raise_exception=True)
                dados.save()
            elif acao in ('suspender', 'reativar'):
                if acao == 'reativar' and not usuario.has_usable_password():
                    raise ValidationError('Uma conta excluída não pode ser reativada.')
                usuario.is_active = acao == 'reativar'
                usuario.save(update_fields=['is_active'])
                revogar_sessoes(usuario)
            else:
                revogar_sessoes(usuario)
            registrar_atividade(request, 'suporte_' + acao, 'conta', usuario.pk, descricao=motivo)
    except Exception:
        registrar_atividade(
            request, 'suporte_' + acao, 'conta', usuario_id,
            resultado='falha', descricao=motivo,
        )
        raise


def decidir_aprovacao(request, perfil_id, aprovado, motivo):
    """Aplica a mesma regra de aprovação nos painéis HTML e React."""
    from acompanhamento.models import PerfilTutor
    from acompanhamento.serializers import PerfilTutorSerializer

    if not request.user.is_staff or not request.user.is_active:
        raise PermissionDenied
    with transaction.atomic():
        perfil = PerfilTutor.objects.select_for_update().select_related('usuario').get(pk=perfil_id)
        validacao = PerfilTutorSerializer(perfil, data={'formacoes': perfil.formacoes}, partial=True)
        if aprovado and (not perfil.ativo or not perfil.usuario.is_active):
            raise ValidationError('O perfil e a conta precisam estar ativos.')
        if aprovado and not validacao.is_valid():
            raise ValidationError('O perfil precisa apresentar pelo menos um certificado válido.')
        if aprovado and perfil.aprovado or not aprovado and perfil.rejeitado_em is not None:
            return perfil
        antes_aprovado = perfil.aprovado
        perfil.aprovado = aprovado
        perfil.motivo_rejeicao = '' if aprovado else ocultar_emails(motivo)
        perfil.rejeitado_em = None if aprovado else timezone.now()
        perfil.save(update_fields=['aprovado', 'motivo_rejeicao', 'rejeitado_em'])
        texto = 'Sua solicitação de tutoria foi aprovada.' if aprovado else (
            'Sua solicitação de tutoria foi rejeitada. Motivo: ' + perfil.motivo_rejeicao
        )
        Notificacao.objects.create(
            destinatario=perfil.usuario, tipo='tutoria_decisao', texto=texto[:250],
            destino='perfil-tutor', recurso_id=perfil.pk, chave=f'tutoria:{uuid4()}',
        )
        registrar_atividade(
            request, 'tutor_aprovado' if aprovado else ('tutor_aprovacao_retirada' if antes_aprovado else 'tutor_rejeitado'),
            'perfil_tutor', perfil.pk, descricao=motivo,
        )
    return perfil
