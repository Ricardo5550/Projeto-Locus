from django.db import models

from core.fields import EncryptedTextField, EncryptedJSONField
from core.models import SoftDeleteModel


class Pergunta(SoftDeleteModel):
    anotacao = models.ForeignKey(
        'anotacoes.Anotacao', on_delete=models.CASCADE, related_name='perguntas'
    )
    questionario = models.ForeignKey('Questionario', null=True, blank=True, on_delete=models.SET_NULL, related_name='perguntas')
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


class Materia(SoftDeleteModel):
    autor = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    nome = models.CharField(max_length=150)

    class Meta:
        ordering = ['nome', 'pk']


class Questionario(SoftDeleteModel):
    autor = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    titulo = models.CharField(max_length=150)
    origem = models.CharField(max_length=230, blank=True, default='', editable=False)
    materia = models.ForeignKey(Materia, null=True, blank=True, on_delete=models.SET_NULL)
    pasta = models.ForeignKey('pastas.Pasta', null=True, blank=True, on_delete=models.SET_NULL)
    versao = models.PositiveIntegerField(default=1)
    facilidade = models.DecimalField(max_digits=8, decimal_places=2, default='2.50')
    sucessos = models.PositiveIntegerField(default=0)
    intervalo = models.PositiveIntegerField(default=0)
    limite_dias = models.PositiveIntegerField(null=True, blank=True)
    proxima_revisao = models.DateField(null=True, blank=True)
    ultima_revisao = models.DateTimeField(null=True, blank=True)
    data_criacao = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['titulo', 'pk']
        constraints = [
            models.UniqueConstraint(
                fields=['autor', 'origem'],
                condition=models.Q(deletado_em__isnull=True) & ~models.Q(origem=''),
                name='revisoes_questionario_origem_ativa',
            ),
        ]


class SessaoRevisao(SoftDeleteModel):
    questionario = models.ForeignKey(Questionario, on_delete=models.CASCADE, related_name='sessoes')
    materia = models.ForeignKey(Materia, null=True, on_delete=models.SET_NULL)
    autor = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    chave = models.UUIDField()
    versao = models.PositiveIntegerField()
    treino = models.BooleanField(default=False)
    respostas = EncryptedJSONField()
    acertos = models.PositiveIntegerField()
    parciais = models.PositiveIntegerField()
    total = models.PositiveIntegerField()
    qualidade = models.PositiveSmallIntegerField()
    data_criacao = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-data_criacao', '-pk']
        constraints = [models.UniqueConstraint(fields=['autor', 'chave'], name='revisao_chave_unica')]
