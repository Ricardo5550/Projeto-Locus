from rest_framework import serializers

from .models import MapaMental


class MapaMentalSerializer(serializers.ModelSerializer):
    dados = serializers.JSONField()

    class Meta:
        model = MapaMental
        fields = [
            'id',
            'titulo',
            'dados',
            'autor',
            'data_criacao',
            'data_atualizacao',
        ]
        read_only_fields = ['id', 'autor', 'data_criacao', 'data_atualizacao']
