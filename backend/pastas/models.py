from django.conf import settings
from django.db import models
from core.models import SoftDeleteModel


class Pasta(SoftDeleteModel):
    nome = models.CharField(max_length=150)
    autor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='pastas')
    pai = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='subpastas')
    data_criacao = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.nome
