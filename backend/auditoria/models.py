from django.conf import settings
from django.db import models


class RegistroAtividade(models.Model):
    ACAO_CHOICES = [
        ('criar', 'Criação'),
        ('editar', 'Edição'),
        ('excluir', 'Exclusão'),
    ]
    RECURSO_CHOICES = [
        ('anotacao', 'Anotação'),
        ('mapa_mental', 'Mapa mental'),
    ]

    acao = models.CharField(max_length=10, choices=ACAO_CHOICES)
    recurso = models.CharField(max_length=20, choices=RECURSO_CHOICES)
    recurso_id = models.PositiveBigIntegerField()
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        editable=False,
    )
    data_hora = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-data_hora', '-id')
        verbose_name = 'registro de atividade'
        verbose_name_plural = 'registros de atividade'

    def __str__(self):
        return f'{self.get_acao_display()} de {self.get_recurso_display()} #{self.recurso_id}'
