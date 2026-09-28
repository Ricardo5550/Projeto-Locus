from django.db import models

from core.fields import EncryptedTextField
from core.models import SoftDeleteModel


class Pergunta(SoftDeleteModel):
    anotacao = models.ForeignKey(
        'anotacoes.Anotacao', on_delete=models.CASCADE, related_name='perguntas'
    )
    enunciado = EncryptedTextField()
    resposta = EncryptedTextField()
    trecho_origem = EncryptedTextField(blank=True)
    data_criacao = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.enunciado[:80]


class Tentativa(SoftDeleteModel):
    pergunta = models.ForeignKey(Pergunta, on_delete=models.CASCADE, related_name='tentativas')
    resposta_digitada = EncryptedTextField(blank=True)
    acertou = models.BooleanField()
    data_criacao = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-data_criacao']
