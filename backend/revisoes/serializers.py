from rest_framework import serializers

from .models import Pergunta, Tentativa, Questionario, Materia


class PerguntaSerializer(serializers.ModelSerializer):
    alternativas = serializers.ListField(
        child=serializers.CharField(max_length=20000), max_length=10, required=False,
    )
    questionario = serializers.PrimaryKeyRelatedField(
        queryset=Questionario.objects.all(), required=False, allow_null=False
    )
    mapa_origem = serializers.UUIDField(write_only=True, required=False)
    visao_origem = serializers.CharField(
        max_length=200, write_only=True, required=False
    )
    manter_agendamento = serializers.BooleanField(
        write_only=True, required=False, default=False
    )
    confirmar_reinicio = serializers.BooleanField(
        write_only=True, required=False, default=False
    )
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
            'tipo',
            'alternativas',
            'alternativa_correta',
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
        if value and (
            value.autor_id != self.context['request'].user.pk or value.deletado_em
        ):
            raise serializers.ValidationError('Questionário inválido.')
        return value

    def validate(self, attrs):
        tipo = attrs.get('tipo', getattr(self.instance, 'tipo', 'dissertativa'))
        if tipo == 'alternativa':
            opcoes = attrs.get('alternativas', getattr(self.instance, 'alternativas', []))
            correta = attrs.get('alternativa_correta', getattr(self.instance, 'alternativa_correta', None))
            if len(opcoes) < 2:
                raise serializers.ValidationError({'alternativas': 'Informe pelo menos duas alternativas.'})
            if len(set(opcoes)) != len(opcoes):
                raise serializers.ValidationError({'alternativas': 'As alternativas devem ser diferentes.'})
            if correta is None or not 0 <= correta < len(opcoes):
                raise serializers.ValidationError({'alternativa_correta': 'Selecione a alternativa correta.'})
            attrs['resposta'] = opcoes[correta]
        else:
            attrs['alternativas'] = []
            attrs['alternativa_correta'] = None
        if 'visao_origem' in attrs and 'mapa_origem' not in attrs:
            raise serializers.ValidationError('Informe o mapa da visão de origem.')
        if any(campo in attrs for campo in ('mapa_origem', 'visao_origem')) and (
            self.instance is not None or 'questionario' in attrs
        ):
            raise serializers.ValidationError(
                'A origem do questionário é definida na criação automática.'
            )
        if (
            self.instance
            and 'anotacao' in attrs
            and attrs['anotacao'] != self.instance.anotacao
        ):
            raise serializers.ValidationError(
                'A anotação de uma pergunta já criada não pode ser alterada.'
            )
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
            raise serializers.ValidationError('Anotação inválida.')

        return anotacao

    def validate_enunciado(self, value):
        if len(value) > 20000:
            raise serializers.ValidationError('Limite de 20000 caracteres.')
        if not value.strip():
            raise serializers.ValidationError('Informe a pergunta.')
        return value.strip()

    def validate_resposta(self, value):
        if len(value) > 20000:
            raise serializers.ValidationError('Limite de 20000 caracteres.')
        if not value.strip():
            raise serializers.ValidationError('Selecione o trecho da resposta.')
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
            raise serializers.ValidationError('Pergunta inválida.')

        return pergunta


class MateriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Materia
        fields = ['id', 'nome']

    def validate_nome(self, valor):
        if not valor.strip():
            raise serializers.ValidationError('Informe o nome da matéria.')
        return valor.strip()


class QuestionarioSerializer(serializers.ModelSerializer):
    materia_nome = serializers.CharField(
        source='materia.nome', default='', read_only=True
    )
    total_perguntas = serializers.SerializerMethodField()

    class Meta:
        model = Questionario
        fields = [
            'id',
            'titulo',
            'materia',
            'materia_nome',
            'pasta',
            'versao',
            'limite_dias',
            'facilidade',
            'sucessos',
            'intervalo',
            'proxima_revisao',
            'ultima_revisao',
            'total_perguntas',
        ]
        read_only_fields = [
            'versao',
            'facilidade',
            'sucessos',
            'intervalo',
            'proxima_revisao',
            'ultima_revisao',
        ]

    def get_total_perguntas(self, obj):
        return obj.perguntas.filter(
            deletado_em__isnull=True, anotacao__deletado_em__isnull=True
        ).count()

    def validate_titulo(self, value):
        if not value.strip():
            raise serializers.ValidationError('Informe o título.')
        return value.strip()

    def validate_materia(self, value):
        if value and (
            value.autor_id != self.context['request'].user.pk or value.deletado_em
        ):
            raise serializers.ValidationError('Matéria inválida.')
        return value

    def validate_pasta(self, value):
        if value and (
            value.autor_id != self.context['request'].user.pk or value.deletado_em
        ):
            raise serializers.ValidationError('Pasta inválida.')
        return value

    def validate_limite_dias(self, value):
        if value is not None and not 1 <= value <= 36500:
            raise serializers.ValidationError(
                'Informe entre 1 e 36500 dias, ou selecione sem limite.'
            )
        return value


class RespostaSerializer(serializers.Serializer):
    pergunta = serializers.UUIDField()
    resposta_digitada = serializers.CharField(
        allow_blank=True, max_length=20000, trim_whitespace=False
    )
    resultado = serializers.ChoiceField(choices=['errei', 'parcial', 'acertei'])
    alternativa = serializers.IntegerField(min_value=0, max_value=9, required=False)


class FinalizacaoSerializer(serializers.Serializer):
    chave = serializers.UUIDField()
    versao = serializers.IntegerField(min_value=1)
    treino = serializers.BooleanField(default=False)
    respostas = RespostaSerializer(many=True, allow_empty=False, max_length=1000)


class FiltrosQuestionarios(serializers.Serializer):
    busca = serializers.CharField(required=False, allow_blank=True, max_length=150)
    materia = serializers.UUIDField(required=False)
    pasta = serializers.UUIDField(required=False)
    situacao = serializers.ChoiceField(
        choices=('hoje', 'atrasadas', 'novos'), required=False
    )
