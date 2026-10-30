from rest_framework import serializers
from pastas.serializers import PastaConteudoMixin

from .models import MapaMental


class MapaMentalSerializer(PastaConteudoMixin, serializers.ModelSerializer):
    dados = serializers.JSONField()

    def validate_dados(self, value):
        if not isinstance(value, dict) or not isinstance(value.get('views'), dict):
            raise serializers.ValidationError('Informe as visões do mapa em um objeto JSON.')
        root = value.get('rootViewId')
        views = value['views']
        if not isinstance(root, str) or root not in views:
            raise serializers.ValidationError('A visão principal do mapa deve existir.')
        note_ids = set()
        for view in views.values():
            if not isinstance(view, dict) or not isinstance(view.get('nodes'), list) or not isinstance(view.get('edges'), list):
                raise serializers.ValidationError('Cada visão deve conter listas de blocos e conexões.')
            for node in view['nodes']:
                if not isinstance(node, dict) or not isinstance(node.get('data'), dict):
                    raise serializers.ValidationError('Bloco inválido.')
                data = node['data']
                child = data.get('linkedViewId')
                if child is not None and (not isinstance(child, str) or child not in views):
                    raise serializers.ValidationError('O mapa interno vinculado deve existir.')
                note_id = data.get('linkedAnnotationId')
                if note_id is not None:
                    if type(note_id) is not int:
                        raise serializers.ValidationError('Anotação vinculada inválida.')
                    note_ids.add(note_id)
        if note_ids:
            from anotacoes.models import Anotacao
            valid = set(Anotacao.objects.filter(pk__in=note_ids, autor=self.context['request'].user).values_list('pk', flat=True))
            if valid != note_ids:
                raise serializers.ValidationError('Vincule apenas anotações ativas da sua conta.')
        return value

    class Meta:
        model = MapaMental
        fields = [
            'id',
            'pasta',
            'titulo',
            'dados',
            'autor',
            'data_criacao',
            'data_atualizacao',
        ]
        read_only_fields = ['id', 'autor', 'data_criacao', 'data_atualizacao']
