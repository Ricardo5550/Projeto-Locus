from allauth.account.models import EmailAddress
from django.contrib.auth import get_user_model
from django.db import transaction
from dj_rest_auth.registration.serializers import RegisterSerializer
from rest_framework import serializers

from .legal import documentos_vigentes, registrar_documentos
from .models import Estudante


class EstudanteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Estudante
        fields = '__all__'


class LocusRegisterSerializer(RegisterSerializer):
    aceite_termos = serializers.BooleanField(write_only=True, required=True)
    ciencia_privacidade = serializers.BooleanField(write_only=True, required=True)

    termos_versao = serializers.CharField(write_only=True, max_length=20)
    privacidade_versao = serializers.CharField(write_only=True, max_length=20)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        termos, privacidade = documentos_vigentes()
        if (
            attrs.get('termos_versao') != termos[2]
            or attrs.get('privacidade_versao') != privacidade[2]
        ):
            raise serializers.ValidationError(
                'Recarregue a página para consultar os documentos vigentes.'
            )
        return attrs

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
            documentos = documentos_vigentes()
            if (
                self.validated_data['termos_versao'] != documentos[0][2]
                or self.validated_data['privacidade_versao'] != documentos[1][2]
            ):
                raise serializers.ValidationError(
                    'Recarregue a página para consultar os documentos vigentes.'
                )
            user = super().save(request)
            registrar_documentos(request, user, documentos)
        return user
