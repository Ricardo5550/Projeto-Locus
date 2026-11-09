from rest_framework import serializers
from mapas.models import MapaMental
from anotacoes.models import Anotacao
from acompanhamento.models import MensagemAcompanhamento, PerfilTutor

class CriarConviteSerializer(serializers.Serializer):
    espaco_id = serializers.IntegerField(min_value=1, max_value=2**63 - 1)
    tutor_id = serializers.IntegerField(min_value=1, max_value=2**63 - 1, required=False)
    usuario_tutor = serializers.CharField(max_length=150, required=False)

    def validate(self, attrs):
        if ('tutor_id' in attrs) == ('usuario_tutor' in attrs):
            raise serializers.ValidationError('Informe um tutor da pesquisa ou o nome de usuário exato.')
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

class FormacaoTutorSerializer(serializers.Serializer):
    titulo = serializers.CharField(max_length=200)
    instituicao = serializers.CharField(max_length=200, allow_blank=True, required=False)
    link_comprovante = serializers.URLField(max_length=500, allow_blank=True, required=False)

    def validate_link_comprovante(self, value):
        if value and not value.lower().startswith(('http://', 'https://')):
            raise serializers.ValidationError('Informe um link HTTP ou HTTPS.')
        return value

    def validate(self, attrs):
        if not attrs.get('titulo'):
            raise serializers.ValidationError({'titulo': 'Informe o nome da formação ou do curso.'})
        attrs.setdefault('instituicao', '')
        attrs.setdefault('link_comprovante', '')
        return attrs


class PerfilTutorSerializer(serializers.ModelSerializer):
    descricao = serializers.CharField(max_length=1000, allow_blank=True, required=False)
    formacoes = FormacaoTutorSerializer(many=True, required=False, max_length=20)

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
            'criado_em',
        ]

        read_only_fields = [
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
        return bool(request and mensagem.tipo_material and mensagem.texto and mensagem.autor_id == request.user.pk)

    class Meta:
        model = MensagemAcompanhamento
        fields = ['id', 'autor_nome', 'texto', 'criada_em', 'resposta_a', 'pode_gerenciar']
        read_only_fields = ['id', 'autor_nome', 'criada_em', 'resposta_a']


class TextoMensagemSerializer(serializers.Serializer):
    texto = serializers.CharField(max_length=2000)


class PublicarMensagemSerializer(TextoMensagemSerializer):
    resposta_a = serializers.IntegerField(min_value=1, max_value=2**63 - 1, required=False)
