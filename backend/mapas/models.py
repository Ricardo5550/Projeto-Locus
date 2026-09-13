from django.db import models


class MapaMental(models.Model):
    titulo = models.CharField(max_length=150)
    dados = models.JSONField(default=dict)
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_atualizacao = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.titulo
