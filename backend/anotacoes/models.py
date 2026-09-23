from django.conf import settings
from django.db import models

## Anotações.
class Anotacao(models.Model):
    titulo = models.CharField(max_length=100)
    conteudo = models.JSONField(default=dict)
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_atualizacao = models.DateTimeField(auto_now=True)
    autor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    def __str__(self):
        return self.titulo
