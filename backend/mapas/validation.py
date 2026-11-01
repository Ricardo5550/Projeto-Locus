import json
import math
import re
from rest_framework.exceptions import ValidationError

DEFAULTS = dict(label='', elementKind='shape', shape='square', connectionMode=False,
    fontSize=16, fontFamily='Arial', textColor='#000000', bold=False, italic=False, strike=False,
    textAlign='center', verticalAlign='center', backgroundColor='#ffffff', borderColor='#5e402b',
    borderWidth=1, borderRadius=0)
NODE_KEYS = {'id','type','position','positionAbsolute','data','style','measured','width','height',
    'selected','dragging','resizing','draggable','selectable','connectable','deletable','hidden','zIndex'}
EDGE_KEYS = {'id','source','target','sourceHandle','targetHandle','type','style','selected','animated','hidden','deletable','selectable'}


def fail(message):
    raise ValidationError(message)


def text(value, name, limit=150, empty=False):
    if not isinstance(value, str) or len(value)>limit or (not empty and not value.strip()):
        fail(f'{name}: texto inválido ou maior que {limit} caracteres.')


def number(value, low, high, name):
    if type(value) not in (int,float) or not math.isfinite(value) or not low<=value<=high:
        fail(f'{name}: valor numérico fora do intervalo permitido.')


def color(value):
    if not isinstance(value,str) or not (value=='transparent' or re.fullmatch(r'#[0-9a-fA-F]{3,8}', value) and len(value) in (4,5,7,9)):
        fail('Cor inválida. Use hexadecimal ou transparent.')


def validate_map(value):
    if not isinstance(value,dict) or set(value)-{'rootViewId','views'}:
        fail('Estrutura principal do mapa inválida.')
    views=value.get('views')
    root=value.get('rootViewId')
    if not isinstance(views,dict) or not 1<=len(views)<=200 or not isinstance(root,str) or root not in views:
        fail('Informe uma visão principal existente e no máximo 200 visões.')
    all_node_ids=set()
    total_nodes=total_edges=0
    links={}
    note_ids=set()
    for view_id,view in views.items():
        text(view_id,'ID da visão',200)
        if not isinstance(view,dict) or set(view)-{'title','nodes','edges'}:
            fail('Visão inválida.')
        text(view.get('title'),'Título da visão')
        if not isinstance(view.get('nodes'),list) or not isinstance(view.get('edges'),list):
            fail('Cada visão deve conter listas de blocos e conexões.')
        total_nodes+=len(view['nodes']);total_edges+=len(view['edges'])
        if total_nodes>5000 or total_edges>10000:
            fail('Limite de 5.000 blocos ou 10.000 conexões excedido.')
        node_ids=set();edge_ids=set();links[view_id]=[]
        for node in view['nodes']:
            if not isinstance(node,dict) or set(node)-NODE_KEYS:
                fail('Bloco contém campos não permitidos.')
            text(node.get('id'),'ID do bloco',200)
            if node['id'] in all_node_ids:fail('IDs de blocos repetidos no mapa.')
            all_node_ids.add(node['id'])
            node_ids.add(node['id'])
            if node.get('type','editable')!='editable':fail('Tipo de bloco não permitido.')
            node.setdefault('type','editable');node.setdefault('position',{'x':0,'y':0})
            for key in ('position','positionAbsolute'):
                if key in node:
                    pos=node[key]
                    if not isinstance(pos,dict) or set(pos)!={'x','y'}:fail('Posição de bloco inválida.')
                    for coordinate in pos.values():number(coordinate,-1000000,1000000,'Posição')
            for key in ('style','measured'):
                if key in node:
                    if not isinstance(node[key],dict) or set(node[key])-{'width','height'}:fail('Propriedades visuais não permitidas.')
                    for size in node[key].values():number(size,1,5000,'Dimensão')
            for key in ('width','height'):
                if key in node:number(node[key],1,5000,'Dimensão')
            if 'zIndex' in node:number(node['zIndex'],-1000,1000,'Camada')
            for key in ('selected','dragging','resizing','draggable','selectable','connectable','deletable','hidden'):
                if key in node and type(node[key]) is not bool:fail('Propriedade booleana de bloco inválida.')
            data=node.get('data')
            if not isinstance(data,dict) or set(data)-set(DEFAULTS)-{'linkedContentType','linkedViewId','linkedAnnotationId'}:
                fail('Dados de bloco inválidos.')
            data={**DEFAULTS,**data};node['data']=data
            text(data['label'],'Nome do bloco',5000,True)
            for key,allowed in [('elementKind',{'shape','text'}),('shape',{'square','circle','triangle','octagon','star'}),
                    ('fontFamily',{'Arial','Verdana','Georgia','Tahoma'}),('textAlign',{'left','center','right'}),('verticalAlign',{'top','center','bottom'})]:
                if not isinstance(data[key],str) or data[key] not in allowed:fail(f'{key}: opção inválida.')
            for key in ('connectionMode','bold','italic','strike'):
                if type(data[key]) is not bool:fail(f'{key}: esperado booleano.')
            for key in ('textColor','backgroundColor','borderColor'):color(data[key])
            number(data['fontSize'],8,72,'Fonte');number(data['borderWidth'],0,12,'Borda');number(data['borderRadius'],0,50,'Arredondamento')
            child=data.get('linkedViewId');note=data.get('linkedAnnotationId');kind=data.get('linkedContentType')
            if kind is not None and kind not in ('annotation','mindmap'):fail('Tipo de conteúdo inválido.')
            if child is not None:
                if not isinstance(child,str) or child not in views or kind=='annotation':fail('Visão vinculada inválida.')
                links[view_id].append(child)
            if note is not None:
                if type(note) is not int or note<=0 or child is not None or kind=='mindmap':fail('Anotação vinculada inválida.')
                note_ids.add(note)
                text(data['label'],'Nome da anotação',100)
        for edge in view['edges']:
            if not isinstance(edge,dict) or set(edge)-EDGE_KEYS:fail('Conexão contém campos não permitidos.')
            text(edge.get('id'),'ID da conexão',200)
            if edge['id'] in edge_ids:fail('IDs de conexões repetidos.')
            edge_ids.add(edge['id'])
            for key in ('source','target'):
                if not isinstance(edge.get(key),str) or edge[key] not in node_ids:fail('Conexão aponta para bloco inexistente.')
            if edge.get('type','straight')!='straight':fail('Tipo de conexão não permitido.')
            for key in ('sourceHandle','targetHandle'):
                if edge.get(key) not in (None,'connection'):fail('Ponto de conexão inválido.')
            for key in ('selected','animated','hidden','deletable','selectable'):
                if key in edge and type(edge[key]) is not bool:fail('Propriedade booleana de conexão inválida.')
            style=edge.get('style',{})
            if not isinstance(style,dict) or set(style)-{'stroke','strokeWidth'}:fail('Estilo de conexão não permitido.')
            if 'stroke' in style:color(style['stroke'])
            if 'strokeWidth' in style:number(style['strokeWidth'],1,10,'Largura da conexão')
    def walk(key,path):
        if key in path:fail('As visões não podem formar ciclos.')
        if len(path)>=32:fail('Limite de 32 níveis de mapas internos excedido.')
        for child in set(links[key]):walk(child,path|{key})
    # Cada caminho é limitado; evita expansão combinatória por múltiplos pais.
    parents={}
    for source,children in links.items():
        for child in children:
            if child==root:fail('A visão principal não pode ser filha de um bloco.')
            parents.setdefault(child,set()).add(source)
            if len(parents[child])>1:fail('Um mapa interno deve pertencer a uma única visão pai.')
    for key in views:walk(key,set())
    try:
        if len(json.dumps(value,ensure_ascii=False,allow_nan=False).encode())>5*1024*1024:fail('Mapa excede 5 MB.')
    except (ValueError,TypeError,RecursionError):fail('JSON do mapa inválido.')
    return value,note_ids
