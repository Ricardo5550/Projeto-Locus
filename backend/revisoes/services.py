from django.db import transaction

from .models import Tentativa


@transaction.atomic
def excluir_pergunta(pergunta):
    """Aplica soft-delete na pergunta e nas tentativas relacionadas."""
    Tentativa.objects.filter(pergunta=pergunta).delete()
    pergunta.delete()
