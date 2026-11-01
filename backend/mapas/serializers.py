from rest_framework import serializers
from pastas.serializers import PastaConteudoMixin

from .models import MapaMental


class MapaMentalSerializer(PastaConteudoMixin, serializers.ModelSerializer):
    dados = serializers.JSONField()

    versao = serializers.CharField(write_only=True, required=False)

    def validate_dados(self, value):
        from .validation import validate_map
        value, note_ids = validate_map(value)
        if note_ids:
            from anotacoes.models import Anotacao
            valid=set(Anotacao.objects.filter(pk__in=note_ids,autor=self.context['request'].user).values_list('pk',flat=True))
            if valid!=note_ids:
                raise serializers.ValidationError('Vincule apenas anotações ativas da sua conta.')
        return value

    def update(self, instance, validated_data):
        from .titles import atualizar_mapa
        return atualizar_mapa(instance, validated_data, self.context['request'])

    def create(self, validated_data):
        validated_data.pop('versao',None)
        from .titles import nodes
        from anotacoes.models import Anotacao
        dados=validated_data['dados']
        ids={n['data'].get('linkedAnnotationId') for n in nodes(dados)}-{None}
        titles=dict(Anotacao.objects.filter(pk__in=ids,autor=self.context['request'].user).values_list('pk','titulo'))
        for node in nodes(dados):
            if node['data'].get('linkedAnnotationId') in titles:
                node['data']['label']=titles[node['data']['linkedAnnotationId']]
            child=node['data'].get('linkedViewId')
            if child in dados['views']:dados['views'][child]['title']=node['data']['label'].strip() or 'Mapa mental'
        dados['views'][dados['rootViewId']]['title']=validated_data['titulo']
        return super().create(validated_data)

    class Meta:
        model = MapaMental
        fields = [
            'id',
            'versao',
            'pasta',
            'titulo',
            'dados',
            'autor',
            'data_criacao',
            'data_atualizacao',
        ]
        read_only_fields = ['id', 'autor', 'data_criacao', 'data_atualizacao']
