from django.conf import settings
from django.db import models


class RegistroAtividade(models.Model):
    ACAO_CHOICES = [
        ('login', 'Login'),
        ('logout', 'Logout'),
        ('criar', 'Criação'),
        ('editar', 'Edição'),
        ('excluir', 'Exclusão'),
        ('responder', 'Resposta'),
    ]
    RECURSO_CHOICES = [
        ('conta', 'Conta'),
        ('anotacao', 'Anotação'),
        ('mapa_mental', 'Mapa mental'),
        ('pergunta', 'Pergunta'),
        ('tentativa', 'Tentativa'),
    ]

    acao = models.CharField(max_length=64)
    recurso = models.CharField(max_length=20, choices=RECURSO_CHOICES)
    recurso_id = models.PositiveBigIntegerField(null=True, blank=True)
    resultado = models.CharField(max_length=12, default='sucesso', choices=[('sucesso', 'Sucesso'), ('falha', 'Falha'), ('bloqueado', 'Bloqueado')])
    endereco_ip = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)
    descricao = models.CharField(max_length=500, blank=True)
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
        return f'{self.acao} de {self.get_recurso_display()} #{self.recurso_id}'
