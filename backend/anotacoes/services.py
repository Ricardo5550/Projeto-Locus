from django.contrib.auth import get_user_model
from django.db import transaction

from mapas.titles import remover_vinculo_anotacao
from revisoes.models import Pergunta, Tentativa, Questionario
from revisoes.services import reiniciar


@transaction.atomic
def excluir_anotacao(anotacao):
    """Aplica soft-delete na anotação e em seus dados de revisão dependentes."""
    if anotacao.autor_id is not None:
        get_user_model().objects.select_for_update().get(pk=anotacao.autor_id)
    questionarios = list(
        Questionario.objects.select_for_update()
        .filter(
            pk__in=Pergunta.objects.filter(anotacao=anotacao).values('questionario')
        )
        .order_by('pk')
    )
    Tentativa.objects.filter(pergunta__anotacao=anotacao).delete()
    Pergunta.objects.filter(anotacao=anotacao).delete()
    anotacao.delete()
    remover_vinculo_anotacao(anotacao)
    for questionario in questionarios:
        reiniciar(questionario)
