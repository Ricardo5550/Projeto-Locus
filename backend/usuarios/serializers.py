from rest_framework import serializers
from .models import Estudante
from django.contrib.auth.models import User

class EstudanteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Estudante
        fields = '__all__'

class RegistroSerializer(serializers.Serializer):
    confirmPassword = serializers.CharField(write_only=True)
    usuario = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        if User.objects.filter(username=data['usuario']).exists():
            raise serializers.ValidationError("Nome de usuário já existe.")
        if data['password'] != data['confirmPassword']:
            raise serializers.ValidationError("As senhas não coincidem.")
        return data

    def create(self, validated_data):
        nome = validated_data.pop('usuario')
        email_usuario = validated_data.pop('email')
        senha = validated_data.pop('password')
        validated_data.pop('confirmPassword')
        user = User.objects.create_user(
            username=nome,
            email=email_usuario,
            password=senha
        )
        estudante = Estudante.objects.create(usuario=user, **validated_data)
        return estudante

    def to_representation(self, instance):
        return {
            'usuario': instance.usuario.username,
            'email': instance.usuario.email,
        }