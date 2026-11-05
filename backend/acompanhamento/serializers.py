from rest_framework import serializers
from mapas.models import MapaMental
from anotacoes.models import Anotacao

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