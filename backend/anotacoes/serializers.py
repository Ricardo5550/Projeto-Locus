from rest_framework import serializers
from pastas.serializers import PastaConteudoMixin

from .models import Anotacao


class AnotacaoSerializer(PastaConteudoMixin, serializers.ModelSerializer):
    conteudo = serializers.JSONField()

    class Meta:
        model = Anotacao
        fields = [
            'id',
            'pasta',
            'titulo',
            'conteudo',
            'autor',
            'data_criacao',
            'data_atualizacao',
        ]
        read_only_fields = ['id', 'autor', 'data_criacao', 'data_atualizacao']
