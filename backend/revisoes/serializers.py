from rest_framework import serializers

from .models import Pergunta, Tentativa, Questionario


class PerguntaSerializer(serializers.ModelSerializer):
    questionario = serializers.PrimaryKeyRelatedField(queryset=Questionario.objects.all(), required=False, allow_null=False)
    mapa_origem = serializers.IntegerField(min_value=1, max_value=2**63 - 1, write_only=True, required=False)
    visao_origem = serializers.CharField(max_length=200, write_only=True, required=False)
    manter_agendamento = serializers.BooleanField(write_only=True, required=False, default=False)
    confirmar_reinicio = serializers.BooleanField(write_only=True, required=False, default=False)
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
            'questionario',
            'mapa_origem',
            'visao_origem',
            'manter_agendamento',
            'confirmar_reinicio',
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

    def validate_questionario(self, value):
        if value and (value.autor_id != self.context['request'].user.pk or value.deletado_em):
            raise serializers.ValidationError('Questionário inválido.')
        return value

    def validate(self, attrs):
        if 'visao_origem' in attrs and 'mapa_origem' not in attrs:
            raise serializers.ValidationError('Informe o mapa da visão de origem.')
        if any(campo in attrs for campo in ('mapa_origem', 'visao_origem')) and (
            self.instance is not None or 'questionario' in attrs
        ):
            raise serializers.ValidationError('A origem do questionário é definida na criação automática.')
        if self.instance and 'anotacao' in attrs and attrs['anotacao'] != self.instance.anotacao:
            raise serializers.ValidationError('A anotação de uma pergunta já criada não pode ser alterada.')
        return attrs

    def create(self, validated_data):
        validated_data.pop('manter_agendamento', None)
        validated_data.pop('confirmar_reinicio', None)
        validated_data.pop('mapa_origem', None)
        validated_data.pop('visao_origem', None)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop('manter_agendamento', None)
        validated_data.pop('confirmar_reinicio', None)
        return super().update(instance, validated_data)

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
        if len(value) > 20000: raise serializers.ValidationError('Limite de 20000 caracteres.')
        if not value.strip():
            raise serializers.ValidationError(
                'Informe a pergunta.'
            )
        return value.strip()

    def validate_resposta(self, value):
        if len(value) > 20000: raise serializers.ValidationError('Limite de 20000 caracteres.')
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