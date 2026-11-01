from django.db import transaction
from django.utils.dateparse import parse_datetime
from django.contrib.auth import get_user_model
from rest_framework.exceptions import APIException, ValidationError
from anotacoes.models import Anotacao
from .models import MapaMental


class MapaDesatualizado(APIException):
    status_code=409
    default_detail='Este mapa foi atualizado em outra tela. Volte à biblioteca e reabra-o antes de salvar, para preservar os nomes e conteúdos atuais.'


def nodes(dados):
    if isinstance(dados,dict) and isinstance(dados.get('views'),dict):
        for view in dados['views'].values():
            if isinstance(view,dict) and isinstance(view.get('nodes'),list):
                for node in view['nodes']:
                    if isinstance(node,dict) and isinstance(node.get('data'),dict):yield node


def sincronizar_titulo_anotacao(anotacao):
    for mapa in MapaMental.objects.select_for_update().filter(autor=anotacao.autor):
        changed=False
        for node in nodes(mapa.dados):
            if node['data'].get('linkedAnnotationId')==anotacao.pk and node['data'].get('label')!=anotacao.titulo:
                node['data']['label']=anotacao.titulo;changed=True
        if changed:mapa.save(update_fields=['dados','data_atualizacao'])


@transaction.atomic
def atualizar_mapa(instance, validated, request):
    get_user_model().objects.select_for_update().get(pk=request.user.pk)
    mapa=MapaMental.objects.select_for_update().get(pk=instance.pk,autor=request.user)
    expected=validated.pop('versao',None)
    try:
        revision=parse_datetime(expected) if expected else None
    except ValueError:
        revision=None
    if 'dados' in validated and revision!=mapa.data_atualizacao:raise MapaDesatualizado()
    dados=validated.get('dados',mapa.dados)
    previous={n['id']:n['data'] for n in nodes(mapa.dados)}
    renamed={}
    for node in nodes(dados):
        data=node['data'];note_id=data.get('linkedAnnotationId')
        old=previous.get(node.get('id'),{})
        if note_id and data.get('label')!=old.get('label'):
            name=data['label'].strip()
            if note_id in renamed and renamed[note_id]!=name:raise ValidationError({'dados':'A mesma anotação recebeu nomes diferentes.'})
            renamed[note_id]=name
    for note in Anotacao.objects.select_for_update().filter(pk__in=renamed,autor=request.user).order_by('pk'):
        if note.titulo!=renamed[note.pk]:
            note.titulo=renamed[note.pk];note.save(update_fields=['titulo','data_atualizacao'])
            sincronizar_titulo_anotacao(note)
    ids={n['data'].get('linkedAnnotationId') for n in nodes(dados)}-{None}
    titles=dict(Anotacao.objects.filter(pk__in=ids,autor=request.user).values_list('pk','titulo'))
    for node in nodes(dados):
        data=node['data']
        if data.get('linkedAnnotationId') in titles:data['label']=titles[data['linkedAnnotationId']]
        child=data.get('linkedViewId')
        if child in dados.get('views',{}):dados['views'][child]['title']=data['label'].strip() or 'Mapa mental'
    for key,value in validated.items():setattr(mapa,key,value)
    if isinstance(dados,dict) and dados.get('rootViewId') in dados.get('views',{}):
        dados['views'][dados['rootViewId']]['title']=mapa.titulo
    mapa.dados=dados;mapa.save()
    return mapa
