from uuid import uuid4
from .models import AlteracaoEmail

from allauth.account.models import EmailAddress
from django.db import transaction
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)

from acompanhamento.models import (
    EspacoAcompanhamento,
    MensagemAcompanhamento,
    PerfilTutor,
)
from anotacoes.models import Anotacao
from mapas.models import MapaMental
from pastas.models import Pasta
from revisoes.models import Pergunta, Tentativa, Materia, Questionario, SessaoRevisao
from notificacoes.models import Notificacao


@transaction.atomic
def anonimizar_e_desativar_conta(user, *, encerramento_controlado=False):
    """Remove PII da conta, desativa o login e preserva rastreabilidade por ID."""
    from django.contrib.auth import get_user_model
    from django.core.exceptions import ValidationError
    from .equipe import bloquear_equipe, impedir_perda_ultimo
    bloquear_equipe()
    user = get_user_model().objects.select_for_update().get(pk=user.pk)
    if user.is_staff or user.is_superuser:
        if not encerramento_controlado:
            raise ValidationError('Contas administrativas exigem encerramento controlado.')
        impedir_perda_ultimo(get_user_model().objects.filter(pk=user.pk), {'is_active': False})
    # Soft-delete dos dados de negócio do usuário.
    Tentativa.objects.filter(pergunta__anotacao__autor=user).delete()
    Pergunta.objects.filter(anotacao__autor=user).delete()
    Anotacao.objects.filter(autor=user).delete()
    MapaMental.objects.filter(autor=user).delete()
    Pasta.objects.filter(autor=user).delete()

    SessaoRevisao.objects.filter(autor=user).delete()
    Questionario.objects.filter(autor=user).delete()
    Materia.objects.filter(autor=user).delete()
    Notificacao.all_objects.filter(destinatario=user).hard_delete()
    MensagemAcompanhamento.objects.filter(autor=user).update(texto='')
    EspacoAcompanhamento.objects.filter(proprietario=user).update(nome='')
    PerfilTutor.objects.filter(usuario=user).update(
        nome_apresentacao='',
        descricao='',
        area='',
        formacoes=[],
        ativo=False, aprovado=False, motivo_rejeicao='', rejeitado_em=None,
    )

    # Revoga todas as sessões JWT ainda conhecidas.
    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)

    # Registros técnicos de verificação não precisam permanecer após anonimização.
    EmailAddress.objects.filter(user=user).delete()
    AlteracaoEmail.objects.filter(usuario=user).delete()
    from .models import SegundoFator, DesafioAutenticacao

    SegundoFator.objects.filter(usuario=user).delete()
    DesafioAutenticacao.objects.filter(usuario=user).delete()

    suffix = uuid4().hex
    user.username = f'usuario_excluido_{user.pk}_{suffix[:8]}'
    user.email = f'excluido-{suffix}@invalid.local'
    user.first_name = ''
    user.last_name = ''
    user.is_active = False
    user.is_staff = False
    user.is_superuser = False
    user.groups.clear()
    user.user_permissions.clear()
    user.set_unusable_password()
    user.save(
        update_fields=[
            'username',
            'email',
            'first_name',
            'last_name',
            'is_active', 'is_staff', 'is_superuser',
            'password',
        ]
    )
