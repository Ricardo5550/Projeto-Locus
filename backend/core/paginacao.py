from django.core.paginator import Paginator
from rest_framework.response import Response


def obter_pagina(request, queryset):
    return Paginator(queryset, 20).get_page(request.query_params.get('pagina', 1))


def responder_pagina(pagina, itens):
    return Response({
        'itens': list(itens),
        'pagina': pagina.number,
        'total_paginas': pagina.paginator.num_pages,
        'total': pagina.paginator.count,
    })
