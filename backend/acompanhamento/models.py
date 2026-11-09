from django.db import models
from django.conf import settings

from core.fields import EncryptedTextField

class PerfilTutor(models.Model):
    class Area(models.TextChoices):
        LINGUAGENS = 'linguagens', 'Linguagens'
        MATEMATICA = 'matematica', 'Matemática'
        NATUREZA = 'natureza', 'Ciências da Natureza'
        HUMANAS = 'humanas', 'Ciências Humanas'
        EDUCACAO = 'educacao', 'Educação'
        TECNOLOGIA = 'tecnologia', 'Tecnologia'
        SAUDE = 'saude', 'Saúde'
        OUTRAS = 'outras', 'Outras áreas'

    usuario = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    nome_apresentacao = models.CharField(max_length=100)
    descricao = models.TextField(blank=True)
    area = models.CharField(max_length=20, choices=Area.choices, blank=True)
    formacoes = models.JSONField(default=list, blank=True)
    visibilidade = models.CharField(
        max_length=20, choices=[('publico', 'Público'), ('privado', 'Privado')], default='privado'
    )
    ativo = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)

class EspacoAcompanhamento(models.Model):
    proprietario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    nome = models.CharField(max_length=100)
    criado_em = models.DateTimeField(auto_now_add=True)

class Participacao(models.Model):
    espaco = models.ForeignKey(EspacoAcompanhamento, on_delete=models.CASCADE)
    tutor = models.ForeignKey(PerfilTutor, on_delete=models.CASCADE)
    ativo = models.BooleanField(default=True)
    entrou_em = models.DateTimeField(auto_now_add=True)
    saiu_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['espaco', 'tutor'],
                condition=models.Q(ativo=True),
                name='unique_participacao_ativa_espaco_tutor'
            )
        ]

class Convite(models.Model):
    espaco = models.ForeignKey(EspacoAcompanhamento, on_delete=models.CASCADE)
    tutor = models.ForeignKey(PerfilTutor, on_delete=models.CASCADE)
    solicitado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    status = models.CharField(
        max_length=20, choices=[('pendente', 'Pendente'), ('aceito', 'Aceito'), ('recusado', 'Recusado'), ('cancelado', 'Cancelado')], default='pendente'
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    respondido_em = models.DateTimeField(null=True, blank=True)

class AnotacaoCompartilhada(models.Model):
    espaco = models.ForeignKey(EspacoAcompanhamento, on_delete=models.CASCADE)
    anotacao = models.ForeignKey('anotacoes.Anotacao', on_delete=models.CASCADE)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['espaco', 'anotacao'],
                name='unique_anotacao_compartilhada_espaco_anotacao'
            )
        ]

class MapaCompartilhado(models.Model):
    espaco = models.ForeignKey(
        EspacoAcompanhamento,
        on_delete=models.CASCADE
    )
    mapa = models.ForeignKey(
        'mapas.MapaMental',
        on_delete=models.CASCADE
    )
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['espaco', 'mapa'],
                name='unique_mapa_compartilhado_espaco_mapa'
            )
        ]


class MensagemAcompanhamento(models.Model):
    class Material(models.TextChoices):
        ANOTACAO = 'anotacao', 'Anotação'
        MAPA = 'mapa', 'Mapa mental'

    espaco = models.ForeignKey(EspacoAcompanhamento, on_delete=models.CASCADE)
    autor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    resposta_a = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE)
    tipo_material = models.CharField(max_length=10, choices=Material.choices, blank=True)
    material_id = models.PositiveBigIntegerField(null=True, blank=True)
    texto = EncryptedTextField(max_length=2000)
    criada_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=['espaco', 'tipo_material', 'material_id', 'id'])]
