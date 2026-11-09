from django.db.models import BooleanField, DateTimeField, Exists, F, OuterRef, Value
from django.db.models.functions import Lower
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated

from anotacoes.models import Anotacao
from core.paginacao import obter_pagina, responder_pagina
from mapas.models import MapaMental
from mapas.services import anotacoes_vinculadas
from revisoes.models import Questionario
from .models import Pasta


class FiltrosBiblioteca(serializers.Serializer):
    pasta = serializers.IntegerField(required=False, min_value=1, max_value=2**63 - 1)
    busca = serializers.CharField(required=False, allow_blank=True, max_length=150)


CAMPOS = ('id', 'tipo', 'titulo_item', 'pasta_item', 'atualizado', 'tem_conteudo', 'ordem', 'nome_ordenacao')


def materiais(queryset, tipo):
    return queryset.annotate(
        tipo=Value(tipo),
        titulo_item=F('titulo'),
        pasta_item=F('pasta_id'),
        atualizado=F('data_atualizacao'),
        tem_conteudo=Value(False, output_field=BooleanField()),
        ordem=Value(1),
        nome_ordenacao=Lower('titulo'),
    ).order_by().values(*CAMPOS)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def biblioteca(request):
    filtros = FiltrosBiblioteca(data=request.query_params)
    filtros.is_valid(raise_exception=True)
    pasta = filtros.validated_data.get('pasta')
    busca = filtros.validated_data.get('busca', '')
    pastas = Pasta.objects.filter(autor=request.user)
    if pasta is not None and not pastas.filter(pk=pasta).exists():
        raise NotFound('Esta pasta não está disponível.')

    mapas = MapaMental.objects.filter(autor=request.user)
    anotacoes = Anotacao.objects.filter(autor=request.user)
    notas_da_pasta = anotacoes.filter(pasta_id=pasta, titulo__icontains=busca)
    if notas_da_pasta.exists():
        # Os vínculos ficam nos mapas criptografados. Leia um mapa por vez
        # para manter a regra de ocultar as anotações vinculadas na Biblioteca.
        vinculadas = set()
        for dados in mapas.order_by().values_list('dados', flat=True).iterator(chunk_size=1):
            vinculadas.update(anotacoes_vinculadas(dados))
        notas_da_pasta = notas_da_pasta.exclude(pk__in=vinculadas)

    subpastas = pastas.filter(pai_id=pasta, nome__icontains=busca).annotate(
        tipo=Value('Pasta'),
        titulo_item=F('nome'),
        pasta_item=F('pai_id'),
        atualizado=Value(None, output_field=DateTimeField()),
        tem_conteudo=(
            Exists(pastas.filter(pai_id=OuterRef('pk')))
            | Exists(anotacoes.filter(pasta_id=OuterRef('pk')))
            | Exists(mapas.filter(pasta_id=OuterRef('pk')))
            | Exists(Questionario.objects.filter(autor=request.user, pasta_id=OuterRef('pk')))
        ),
        ordem=Value(0),
        nome_ordenacao=Lower('nome'),
    ).order_by().values(*CAMPOS)

    itens = subpastas.union(
        materiais(mapas.filter(pasta_id=pasta, titulo__icontains=busca), 'Mapa mental'),
        materiais(notas_da_pasta, 'Anotação'),
        all=True,
    ).order_by('ordem', 'nome_ordenacao', 'tipo', 'id')
    pagina = obter_pagina(request, itens)
    return responder_pagina(pagina, (
        {
            'id': item['id'],
            'type': item['tipo'],
            'title': item['titulo_item'],
            'folder': item['pasta_item'],
            'updatedAt': item['atualizado'],
            'hasContent': item['tem_conteudo'],
        }
        for item in pagina
    ))
