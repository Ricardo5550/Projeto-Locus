from django.conf import settings
from django.contrib.auth.models import User
from django.db import models


class Estudante(models.Model):
    usuario = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
    )

    def __str__(self):
        return self.usuario.username


class AceiteLegal(models.Model):
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
    tipo_manifestacao = models.CharField(max_length=20, choices=TipoManifestacao.choices)
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
