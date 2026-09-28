from uuid import uuid4

from allauth.account.models import EmailAddress
from django.db import transaction
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from anotacoes.models import Anotacao
from mapas.models import MapaMental
from revisoes.models import Pergunta, Tentativa


@transaction.atomic
def anonimizar_e_desativar_conta(user):
    """Remove PII da conta, desativa o login e preserva rastreabilidade por ID."""
    # Soft-delete dos dados de negócio do usuário.
    Tentativa.objects.filter(pergunta__anotacao__autor=user).delete()
    Pergunta.objects.filter(anotacao__autor=user).delete()
    Anotacao.objects.filter(autor=user).delete()
    MapaMental.objects.filter(autor=user).delete()

    # Revoga todas as sessões JWT ainda conhecidas.
    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)

    # Registros técnicos de verificação não precisam permanecer após anonimização.
    EmailAddress.objects.filter(user=user).delete()

    suffix = uuid4().hex
    user.username = f'usuario_excluido_{user.pk}_{suffix[:8]}'
    user.email = f'excluido-{suffix}@invalid.local'
    user.first_name = ''
    user.last_name = ''
    user.is_active = False
    user.set_unusable_password()
    user.save(
        update_fields=[
            'username',
            'email',
            'first_name',
            'last_name',
            'is_active',
            'password',
        ]
    )
