from django.conf import settings
from django.db import models

from core.fields import EncryptedJSONField
from core.models import SoftDeleteModel


class Anotacao(SoftDeleteModel):
    titulo = models.CharField(max_length=100)
    conteudo = EncryptedJSONField(default=dict)
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_atualizacao = models.DateTimeField(auto_now=True)
    autor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='anotacoes',
    )

    def __str__(self):
        return self.titulo
