from rest_framework import serializers
from mapas.models import MapaMental
from anotacoes.models import Anotacao
from acompanhamento.models import PerfilTutor

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

class PerfilTutorSerializer(serializers.ModelSerializer):

    class Meta:
        model = PerfilTutor
        fields = [
            'id',
            'nome_apresentacao',
            'descricao',
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