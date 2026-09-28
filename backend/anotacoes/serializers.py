from rest_framework import serializers

from .models import Anotacao


class AnotacaoSerializer(serializers.ModelSerializer):
    conteudo = serializers.JSONField()

    class Meta:
        model = Anotacao
        fields = [
            'id',
            'titulo',
            'conteudo',
            'autor',
            'data_criacao',
            'data_atualizacao',
        ]
        read_only_fields = ['id', 'autor', 'data_criacao', 'data_atualizacao']
