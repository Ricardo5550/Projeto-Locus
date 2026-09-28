from django.db import transaction

from revisoes.models import Pergunta, Tentativa


@transaction.atomic
def excluir_anotacao(anotacao):
    """Aplica soft-delete na anotação e em seus dados de revisão dependentes."""
    Tentativa.objects.filter(pergunta__anotacao=anotacao).delete()
    Pergunta.objects.filter(anotacao=anotacao).delete()
    anotacao.delete()
