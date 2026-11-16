from uuid import uuid4

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from core.fields import EncryptedTextField


class Usuario(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)


class Estudante(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    usuario = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
    )

    def __str__(self):
        return self.usuario.username


class AceiteLegal(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)

    class TipoDocumento(models.TextChoices):
        TERMOS = 'terms', 'Termos de Uso'
        PRIVACIDADE = 'privacy', 'Política de Privacidade'

    class TipoManifestacao(models.TextChoices):
        ACEITE = 'acceptance', 'Aceite'
        CIENCIA = 'acknowledgement', 'Ciência de leitura'

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='aceites_legais',
    )
    tipo_documento = models.CharField(max_length=20, choices=TipoDocumento.choices)
    tipo_manifestacao = models.CharField(
        max_length=20, choices=TipoManifestacao.choices
    )
    versao = models.CharField(max_length=20)
    hash_documento = models.CharField(max_length=64)
    aceito_em = models.DateTimeField(auto_now_add=True)
    endereco_ip = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)

    class Meta:
        ordering = ['-aceito_em']
        constraints = [
            models.UniqueConstraint(
                fields=['usuario', 'tipo_documento', 'versao'],
                name='unique_user_legal_document_version',
            ),
        ]

    def __str__(self):
        return f'{self.usuario_id} - {self.tipo_documento} v{self.versao}'


class EstadoAutenticacao(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    usuario = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    versao = models.PositiveIntegerField(default=0)


class AlteracaoEmail(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    usuario = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    email = models.EmailField(unique=True)
    email_anterior = models.EmailField()
    nonce = models.UUIDField(default=uuid4, editable=False)
    criado_em = models.DateTimeField(auto_now=True)


class SegundoFator(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    usuario = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    segredo = EncryptedTextField()
    ativo = models.BooleanField(default=False)
    criado_em = models.DateTimeField(auto_now_add=True)
    ultimo_contador = models.BigIntegerField(default=-1)
    recuperacao = models.JSONField(default=list)

    class Meta:
        permissions = [
            ('suporte_contas', 'Atender contas sem acessar conteúdos de estudo')
        ]


class DesafioAutenticacao(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    resumo = models.CharField(max_length=64, unique=True)
    contexto = models.CharField(max_length=10)
    versao = models.PositiveIntegerField()
    senha_assinada = models.CharField(max_length=64)
    expira_em = models.DateTimeField()
    tentativas = models.PositiveSmallIntegerField(default=0)
    usado = models.BooleanField(default=False)


class PoliticaPrivacidade(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    versao = models.CharField(max_length=20, unique=True)
    conteudo = models.TextField()
    publicada_em = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-publicada_em', '-pk']
        verbose_name = 'versão da Política de Privacidade'
        verbose_name_plural = 'versões da Política de Privacidade'

    def __str__(self):
        return f'Política de Privacidade {self.versao}'


class TermosUso(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    versao = models.CharField(max_length=20, unique=True)
    conteudo = models.TextField()
    publicada_em = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-publicada_em', '-pk']
        verbose_name = 'versão dos Termos de Uso'
        verbose_name_plural = 'versões dos Termos de Uso'

    def __str__(self):
        return f'Termos de Uso {self.versao}'
