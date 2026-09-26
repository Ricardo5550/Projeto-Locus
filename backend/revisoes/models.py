from django.db import models


class Pergunta(models.Model):
    anotacao = models.ForeignKey(
        'anotacoes.Anotacao', on_delete=models.CASCADE, related_name='perguntas'
    )
    enunciado = models.TextField()
    resposta = models.TextField()
    trecho_origem = models.TextField(blank=True)
    data_criacao = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.enunciado[:80]


class Tentativa(models.Model):
    pergunta = models.ForeignKey(Pergunta, on_delete=models.CASCADE, related_name='tentativas')
    resposta_digitada = models.TextField(blank=True)
    acertou = models.BooleanField()
    data_criacao = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-data_criacao']
