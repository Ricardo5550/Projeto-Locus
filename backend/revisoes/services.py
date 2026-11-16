from datetime import timedelta
from django.utils import timezone
from notificacoes.models import Notificacao
from django.db import transaction

from .models import Tentativa


@transaction.atomic
def excluir_pergunta(pergunta):
    """Aplica soft-delete na pergunta e nas tentativas relacionadas."""
    Tentativa.objects.filter(pergunta=pergunta).delete()
    pergunta.delete()


def reiniciar(questionario):
    questionario.versao += 1
    questionario.facilidade = '2.50'
    questionario.sucessos = questionario.intervalo = 0
    if questionario.ultima_revisao:
        amanha = timezone.localdate() + timedelta(days=1)
        questionario.proxima_revisao = min(
            questionario.proxima_revisao or amanha, amanha
        )
    if not questionario.perguntas.filter(
        deletado_em__isnull=True, anotacao__deletado_em__isnull=True
    ).exists():
        questionario.proxima_revisao = None
    questionario.save()
    Notificacao.objects.filter(
        destinatario=questionario.autor, tipo='revisao', recurso_id=questionario.pk
    ).delete()
