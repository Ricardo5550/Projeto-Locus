from rest_framework import serializers

from .models import Pergunta, Tentativa


class PerguntaSerializer(serializers.ModelSerializer):
    titulo_anotacao = serializers.CharField(
        source='anotacao.titulo',
        read_only=True,
    )
    total_tentativas = serializers.IntegerField(
        source='tentativas.count',
        read_only=True,
    )

    class Meta:
        model = Pergunta
        fields = [
            'id',
            'anotacao',
            'titulo_anotacao',
            'enunciado',
            'resposta',
            'trecho_origem',
            'data_criacao',
            'total_tentativas',
        ]
        read_only_fields = [
            'id',
            'data_criacao',
            'titulo_anotacao',
            'total_tentativas',
        ]

    def validate_anotacao(self, anotacao):
        request = self.context.get('request')

        if (
            request is None
            or not request.user.is_authenticated
            or anotacao.autor_id != request.user.id
        ):
            raise serializers.ValidationError(
                'Anotação inválida.'
            )

        return anotacao

    def validate_enunciado(self, value):
        if not value.strip():
            raise serializers.ValidationError(
                'Informe a pergunta.'
            )
        return value.strip()

    def validate_resposta(self, value):
        if not value.strip():
            raise serializers.ValidationError(
                'Selecione o trecho da resposta.'
            )
        return value.strip()


class TentativaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tentativa
        fields = [
            'id',
            'pergunta',
            'resposta_digitada',
            'acertou',
            'data_criacao',
        ]
        read_only_fields = [
            'id',
            'data_criacao',
        ]

    def validate_pergunta(self, pergunta):
        request = self.context.get('request')

        if (
            request is None
            or not request.user.is_authenticated
            or pergunta.anotacao.autor_id != request.user.id
        ):
            raise serializers.ValidationError(
                'Pergunta inválida.'
            )

        return pergunta