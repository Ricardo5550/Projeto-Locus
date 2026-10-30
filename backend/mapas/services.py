"""Exclusão de um projeto e conversão das suas visões internas em pastas."""
from django.db import transaction
from django.shortcuts import get_object_or_404
from anotacoes.models import Anotacao
from anotacoes.services import excluir_anotacao
from auditoria.services import registrar_atividade
from pastas.models import Pasta
from .models import MapaMental


def visoes(dados):
    if not isinstance(dados, dict):
        return {}
    value = dados.get('views', {})
    return value if isinstance(value, dict) else {}


def blocos(view):
    nodes = view.get('nodes', []) if isinstance(view, dict) else []
    if not isinstance(nodes, list):
        return
    for node in nodes:
        if isinstance(node, dict) and isinstance(node.get('data'), dict):
            yield node['data']


def anotacoes_vinculadas(dados):
    return {node['linkedAnnotationId'] for view in visoes(dados).values() for node in blocos(view)
            if type(node.get('linkedAnnotationId')) is int}


@transaction.atomic
def excluir_mapa(mapa, modo, request):
    # Bloqueia o registro durante a conversão e a exclusão.
    mapa = get_object_or_404(MapaMental.objects.select_for_update(), pk=mapa.pk, autor=request.user)
    views = visoes(mapa.dados)
    ids = anotacoes_vinculadas(mapa.dados)
    protegidas = set()
    for outro in MapaMental.objects.filter(autor=request.user).exclude(pk=mapa.pk):
        protegidas.update(anotacoes_vinculadas(outro.dados))
    notas = {nota.pk: nota for nota in Anotacao.objects.select_for_update().filter(
        pk__in=ids - protegidas, autor=request.user)}
    pasta_raiz = None

    if modo == 'excluir_tudo':
        for nota in notas.values():
            excluir_anotacao(nota)
            registrar_atividade(request, 'excluir', 'anotacao', nota.pk)
    else:
        # Mesmo sem anotações, a hierarquia do mapa é preservada em pastas.
        pasta_raiz = Pasta.objects.create(nome=mapa.titulo, autor=request.user, pai=mapa.pasta)
        registrar_atividade(request, 'criar', 'pasta', pasta_raiz.pk)
        visited = set()
        scheduled = set()
        assigned = set()
        root_id = mapa.dados.get('rootViewId') if isinstance(mapa.dados, dict) else None
        pending = [(root_id, pasta_raiz)] if isinstance(root_id, str) and root_id in views else []

        if pending:
            scheduled.add(root_id)

        def percorrer():
            while pending:
                view_id, pasta = pending.pop()
                if view_id in visited:
                    continue
                visited.add(view_id)
                for node in blocos(views.get(view_id)):
                    nota = notas.get(node.get('linkedAnnotationId')) if type(node.get('linkedAnnotationId')) is int else None
                    if nota and nota.pk not in assigned:
                        nota.pasta = pasta
                        nota.save(update_fields=['pasta', 'data_atualizacao'])
                        assigned.add(nota.pk)
                        registrar_atividade(request, 'editar', 'anotacao', nota.pk)
                    child = node.get('linkedViewId')
                    if isinstance(child, str) and child in views and child not in scheduled:
                        child_view = views[child]
                        nome = node.get('label') or (child_view.get('title') if isinstance(child_view, dict) else None) or 'Mapa mental'
                        subpasta = Pasta.objects.create(nome=str(nome)[:150], autor=request.user, pai=pasta)
                        registrar_atividade(request, 'criar', 'pasta', subpasta.pk)
                        # Marca ao agendar para impedir pastas duplicadas por referências repetidas/ciclos.
                        scheduled.add(child)
                        pending.append((child, subpasta))

        # Uma referência por visão vira uma pasta; ciclos e referências repetidas são ignorados.
        percorrer()
        for view_id, view in views.items():
            if view_id not in visited:
                nome = view.get('title', 'Mapa mental') if isinstance(view, dict) else 'Mapa mental'
                pasta = Pasta.objects.create(nome=str(nome)[:150], autor=request.user, pai=pasta_raiz)
                registrar_atividade(request, 'criar', 'pasta', pasta.pk)
                scheduled.add(view_id)
                pending.append((view_id, pasta))
                percorrer()
        for nota in notas.values():
            if nota.pk not in assigned:
                nota.pasta = pasta_raiz
                nota.save(update_fields=['pasta', 'data_atualizacao'])
    mapa.delete()
    registrar_atividade(request, 'excluir', 'mapa_mental', mapa.pk)
    return pasta_raiz
