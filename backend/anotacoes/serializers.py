from rest_framework import serializers
from pastas.serializers import PastaConteudoMixin

from .models import Anotacao


class AnotacaoSerializer(PastaConteudoMixin, serializers.ModelSerializer):
    conteudo = serializers.JSONField()

    def validate_conteudo(self, value):
        from .validation import validate_document
        return validate_document(value)

    def validate_titulo(self, value):
        if not value.strip():
            raise serializers.ValidationError('Informe um título para a anotação.')
        return value.strip()

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
