from django.conf import settings
from django.db import models
from core.models import SoftDeleteModel


class Notificacao(SoftDeleteModel):
    destinatario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    tipo = models.CharField(max_length=40)
    texto = models.CharField(max_length=250)
    destino = models.CharField(max_length=40)
    recurso_id = models.PositiveIntegerField()
    chave = models.CharField(max_length=150)
    lida = models.BooleanField(default=False)
    data_criacao = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-data_criacao', '-pk']
        constraints = [models.UniqueConstraint(fields=['destinatario', 'chave'], name='notificacao_evento_unico')]
