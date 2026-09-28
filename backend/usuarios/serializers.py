from allauth.account.models import EmailAddress
from django.contrib.auth import get_user_model
from django.db import transaction
from dj_rest_auth.registration.serializers import RegisterSerializer
from rest_framework import serializers

from .legal import (
    PRIVACIDADE_HASH_SHA256,
    PRIVACIDADE_VERSAO,
    TERMOS_HASH_SHA256,
    TERMOS_VERSAO,
    obter_ip_cliente,
)
from .models import AceiteLegal, Estudante


class EstudanteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Estudante
        fields = '__all__'


class LocusRegisterSerializer(RegisterSerializer):
    aceite_termos = serializers.BooleanField(write_only=True, required=True)
    ciencia_privacidade = serializers.BooleanField(write_only=True, required=True)

    def validate_email(self, value):
        email = super().validate_email(value).strip().lower()
        User = get_user_model()

        if (
            User.objects.filter(email__iexact=email).exists()
            or EmailAddress.objects.filter(email__iexact=email).exists()
        ):
            raise serializers.ValidationError(
                'Já existe uma conta cadastrada com este e-mail.'
            )

        return email

    def validate_aceite_termos(self, value):
        if value is not True:
            raise serializers.ValidationError(
                'É necessário aceitar os Termos de Uso para criar a conta.'
            )
        return value

    def validate_ciencia_privacidade(self, value):
        if value is not True:
            raise serializers.ValidationError(
                'É necessário declarar a leitura da Política de Privacidade.'
            )
        return value

    def save(self, request):
        with transaction.atomic():
            user = super().save(request)
            endereco_ip = obter_ip_cliente(request)
            user_agent = (request.META.get('HTTP_USER_AGENT') or '')[:500]

            AceiteLegal.objects.create(
                usuario=user,
                tipo_documento=AceiteLegal.TipoDocumento.TERMOS,
                tipo_manifestacao=AceiteLegal.TipoManifestacao.ACEITE,
                versao=TERMOS_VERSAO,
                hash_documento=TERMOS_HASH_SHA256,
                endereco_ip=endereco_ip,
                user_agent=user_agent,
            )
            AceiteLegal.objects.create(
                usuario=user,
                tipo_documento=AceiteLegal.TipoDocumento.PRIVACIDADE,
                tipo_manifestacao=AceiteLegal.TipoManifestacao.CIENCIA,
                versao=PRIVACIDADE_VERSAO,
                hash_documento=PRIVACIDADE_HASH_SHA256,
                endereco_ip=endereco_ip,
                user_agent=user_agent,
            )

        return user
