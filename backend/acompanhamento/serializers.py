from rest_framework import serializers
from mapas.models import MapaMental
from anotacoes.models import Anotacao
from revisoes.models import Pergunta
from acompanhamento.models import MensagemAcompanhamento, PerfilTutor


class CriarConviteSerializer(serializers.Serializer):
    espaco_id = serializers.UUIDField()
    tutor_id = serializers.UUIDField(required=False)
    usuario_tutor = serializers.CharField(max_length=150, required=False)

    def validate(self, attrs):
        if ('tutor_id' in attrs) == ('usuario_tutor' in attrs):
            raise serializers.ValidationError(
                'Informe um tutor da pesquisa ou o nome de usuário exato.'
            )
        return attrs


class AnotacaoCompartilhadaLeituraSerializer(serializers.ModelSerializer):
    conteudo = serializers.JSONField(read_only=True)

    class Meta:
        model = Anotacao
        fields = [
            'id',
            'titulo',
            'conteudo',
        ]
        read_only_fields = fields


class MapaCompartilhadoLeituraSerializer(serializers.ModelSerializer):
    dados = serializers.JSONField(read_only=True)

    class Meta:
        model = MapaMental
        fields = [
            'id',
            'titulo',
            'dados',
        ]
        read_only_fields = fields


class PerguntaCompartilhadaLeituraSerializer(serializers.ModelSerializer):
    alternativas = serializers.JSONField(read_only=True)

    class Meta:
        model = Pergunta
        fields = ['id', 'enunciado', 'resposta', 'tipo', 'alternativas', 'alternativa_correta']
        read_only_fields = fields


class FormacaoTutorSerializer(serializers.Serializer):
    titulo = serializers.CharField(max_length=200)
    instituicao = serializers.CharField(
        max_length=200, allow_blank=True, required=False
    )
    link_comprovante = serializers.URLField(
        max_length=500
    )

    def validate_link_comprovante(self, value):
        if value and not value.lower().startswith(('http://', 'https://')):
            raise serializers.ValidationError('Informe um link HTTP ou HTTPS.')
        return value

    def validate(self, attrs):
        if not attrs.get('titulo'):
            raise serializers.ValidationError(
                {'titulo': 'Informe o nome da formação ou do curso.'}
            )
        attrs.setdefault('instituicao', '')
        attrs.setdefault('link_comprovante', '')
        return attrs


class PerfilTutorSerializer(serializers.ModelSerializer):
    situacao = serializers.CharField(read_only=True)
    descricao = serializers.CharField(max_length=1000, allow_blank=True, required=False)
    formacoes = FormacaoTutorSerializer(many=True, min_length=1, max_length=20)

    def validate(self, attrs):
        formacoes = attrs.get('formacoes', getattr(self.instance, 'formacoes', []))
        if not formacoes or not any(item.get('link_comprovante') for item in formacoes):
            raise serializers.ValidationError({'formacoes': 'Informe pelo menos um diploma ou certificado com link de comprovação.'})
        return attrs

    def update(self, instance, validated_data):
        # Uma comprovação alterada precisa passar novamente pela aprovação.
        if any(
            campo in validated_data and validated_data[campo] != getattr(instance, campo)
            for campo in ('formacoes', 'area')
        ):
            validated_data['aprovado'] = False
        if instance.rejeitado_em is not None:
            validated_data.update(aprovado=False, motivo_rejeicao='', rejeitado_em=None)
        return super().update(instance, validated_data)

    class Meta:
        model = PerfilTutor
        fields = [
            'id',
            'nome_apresentacao',
            'descricao',
            'area',
            'formacoes',
            'visibilidade',
            'ativo',
            'aprovado', 'situacao', 'motivo_rejeicao', 'rejeitado_em',
            'criado_em',
        ]

        read_only_fields = [
            'situacao', 'motivo_rejeicao', 'rejeitado_em',
            'aprovado',
            'id',
            'criado_em',
        ]

    def validate_nome_apresentacao(self, value):
        nome = value.strip()

        if not nome:
            raise serializers.ValidationError('Informe um nome de apresentação válido.')

        return nome


class MensagemAcompanhamentoSerializer(serializers.ModelSerializer):
    autor_nome = serializers.CharField(source='autor.username', read_only=True)
    pode_gerenciar = serializers.SerializerMethodField()

    def get_pode_gerenciar(self, mensagem):
        request = self.context.get('request')
        return bool(
            request
            and mensagem.tipo_material
            and mensagem.texto
            and mensagem.autor_id == request.user.pk
        )

    class Meta:
        model = MensagemAcompanhamento
        fields = [
            'id',
            'autor_nome',
            'texto',
            'criada_em',
            'resposta_a',
            'pode_gerenciar',
        ]
        read_only_fields = ['id', 'autor_nome', 'criada_em', 'resposta_a']


class TextoMensagemSerializer(serializers.Serializer):
    texto = serializers.CharField(max_length=2000)


class PublicarMensagemSerializer(TextoMensagemSerializer):
    resposta_a = serializers.UUIDField(required=False)
