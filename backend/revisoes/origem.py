from rest_framework.exceptions import ValidationError

from mapas.models import MapaMental
from mapas.services import blocos, visoes
from pastas.models import Pasta

from .models import Questionario


def origem_no_mapa(mapa, anotacao_id, visao_id=None):
    for identificador, visao in visoes(mapa.dados).items():
        if visao_id is not None and identificador != visao_id:
            continue
        if any(bloco.get('linkedAnnotationId') == anotacao_id for bloco in blocos(visao)):
            titulo = visao.get('title')
            if identificador == mapa.dados.get('rootViewId') or not isinstance(titulo, str) or not titulo.strip():
                titulo = mapa.titulo
            return f'mapa:{mapa.pk}:{identificador}', titulo[:150]
    return None


def identificar_origem(anotacao, mapa_id=None, visao_id=None):
    mapas = MapaMental.objects.filter(autor_id=anotacao.autor_id)
    if mapa_id is not None:
        mapa = mapas.filter(pk=mapa_id).first()
        if mapa and visao_id is None and isinstance(mapa.dados, dict):
            visao_id = mapa.dados.get('rootViewId')
        origem = origem_no_mapa(mapa, anotacao.pk, visao_id) if mapa else None
        if origem is None:
            raise ValidationError('O mapa informado não está vinculado a esta anotação.')
        return origem

    # A anotação também pode ser aberta pela devolutiva, sem o contexto do mapa.
    for mapa in mapas.only('id', 'titulo', 'dados').order_by('pk').iterator(chunk_size=1):
        origem = origem_no_mapa(mapa, anotacao.pk)
        if origem is not None:
            return origem

    pasta = Pasta.objects.filter(pk=anotacao.pasta_id, autor_id=anotacao.autor_id).first()
    if pasta:
        return f'pasta:{pasta.pk}', pasta.nome
    return f'anotacao:{anotacao.pk}', anotacao.titulo


def questionario_da_origem(anotacao, mapa_id=None, visao_id=None):
    origem, titulo = identificar_origem(anotacao, mapa_id, visao_id)
    questionario, criado = Questionario.objects.select_for_update().get_or_create(
        autor_id=anotacao.autor_id, origem=origem, defaults={'titulo': titulo},
    )
    return questionario, criado
