from django.db import transaction

from revisoes.models import Pergunta, Tentativa, Questionario
from revisoes.questionarios import reiniciar


@transaction.atomic
def excluir_anotacao(anotacao):
    """Aplica soft-delete na anotação e em seus dados de revisão dependentes."""
    questionarios = list(Questionario.objects.select_for_update().filter(pk__in=Pergunta.objects.filter(anotacao=anotacao).values('questionario')).order_by('pk'))
    Tentativa.objects.filter(pergunta__anotacao=anotacao).delete()
    Pergunta.objects.filter(anotacao=anotacao).delete()
    anotacao.delete()
    for questionario in questionarios: reiniciar(questionario)
