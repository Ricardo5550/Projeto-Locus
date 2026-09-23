"""Endpoint REST para busca de referências acadêmicas."""

import logging

from django.core.cache import cache
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .services import CrossrefIndisponivel, pesquisar_crossref


logger = logging.getLogger(__name__)


@api_view(['GET'])
def buscar_referencias(request):
    termo = request.query_params.get('q', '').strip()
    if not 2 <= len(termo) <= 200:
        return Response(
            {'mensagem': 'Informe um termo de pesquisa entre 2 e 200 caracteres.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    chave_cache = f'crossref:busca:{termo.casefold()}'
    resultados = cache.get(chave_cache)
    if resultados is None:
        try:
            resultados = pesquisar_crossref(termo)
        except CrossrefIndisponivel:
            logger.warning('Falha ao consultar a API Crossref.', exc_info=True)
            return Response(
                {'mensagem': 'Não foi possível consultar as referências agora. Tente novamente em alguns instantes.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        cache.set(chave_cache, resultados, timeout=600)

    return Response({'resultados': resultados})
