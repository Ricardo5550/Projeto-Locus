from copy import deepcopy
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from anotacoes.models import Anotacao
from .models import MapaMental


def doc(nodes=None,edges=None):
    return {'rootViewId':'root','views':{'root':{'title':'Mapa','nodes':nodes or [],'edges':edges or []}}}


def node(id='n',**data):
    return {'id':id,'position':{'x':0,'y':0},'type':'editable','data':{'label':'Nome',**data}}


class MapValidationTitleTests(TestCase):
    def setUp(self):
        self.user=get_user_model().objects.create_user('test','test@example.test','senha')
        self.client=APIClient();self.client.force_authenticate(self.user)
        self.note=Anotacao.objects.create(titulo='Vida',conteudo={},autor=self.user)

    def create(self,data):
        return self.client.post('/api/mapas-mentais/',{'titulo':'Sistema solar','dados':data},format='json')

    def test_criacao_canoniza_nome_de_anotacao(self):
        response=self.create(doc([node(linkedAnnotationId=self.note.pk)]))
        self.assertEqual(response.status_code,201,response.data)
        self.assertEqual(response.data['dados']['views']['root']['nodes'][0]['data']['label'],'Vida')

    def test_nome_da_anotacao_atualiza_todas_as_formas_e_rejeita_mapa_antigo(self):
        first=self.create(doc([node(linkedAnnotationId=self.note.pk)]))
        second=self.create(doc([node('segundo',linkedAnnotationId=self.note.pk)]))
        response=self.client.patch(f'/api/anotacoes/{self.note.pk}/',{'titulo':'Vida na Terra'},format='json')
        self.assertEqual(response.status_code,200)
        for map_id in [first.data['id'],second.data['id']]:
            actual=self.client.get(f'/api/mapas-mentais/{map_id}/').data
            self.assertEqual(actual['dados']['views']['root']['nodes'][0]['data']['label'],'Vida na Terra')
        old=self.client.put(f"/api/mapas-mentais/{first.data['id']}/",{'titulo':'Sistema solar','dados':first.data['dados'],'versao':first.data['data_atualizacao']},format='json')
        self.assertEqual(old.status_code,409)
        self.note.refresh_from_db();self.assertEqual(self.note.titulo,'Vida na Terra')

    def test_editar_nome_da_forma_atualiza_anotacao_e_outros_mapas(self):
        first=self.create(doc([node(linkedAnnotationId=self.note.pk)]))
        second=self.create(doc([node('segundo',linkedAnnotationId=self.note.pk)]))
        data=deepcopy(first.data['dados']);data['views']['root']['nodes'][0]['data']['label']='Clima'
        response=self.client.put(f"/api/mapas-mentais/{first.data['id']}/",{'titulo':'Sistema solar','dados':data,'versao':first.data['data_atualizacao']},format='json')
        self.assertEqual(response.status_code,200,response.data)
        self.note.refresh_from_db();self.assertEqual(self.note.titulo,'Clima')
        other=self.client.get(f"/api/mapas-mentais/{second.data['id']}/").data
        self.assertEqual(other['dados']['views']['root']['nodes'][0]['data']['label'],'Clima')

    def test_mapa_interno_tem_nome_vinculado_a_forma(self):
        data=doc([node(linkedViewId='child',label='Terra')])
        data['views']['child']={'title':'Antigo','nodes':[],'edges':[]}
        response=self.create(data)
        self.assertEqual(response.status_code,201,response.data)
        self.assertEqual(response.data['dados']['views']['child']['title'],'Terra')

    def test_anotacao_sem_titulo_recusada(self):
        self.assertEqual(self.client.post('/api/anotacoes/',{'titulo':'   ','conteudo':{}},format='json').status_code,400)

    def test_conexao_para_bloco_inexistente(self):
        data=doc([node()],[{'id':'e','source':'n','target':'ausente'}])
        self.assertEqual(self.create(data).status_code,400)

    def test_ids_repetidos(self):
        self.assertEqual(self.create(doc([node(),node()])).status_code,400)

    def test_tipos_propriedades_css_e_numeros_invalidos(self):
        for data in [doc([node(shape='script')]),doc([node(fontSize=10000)]),doc([node(backgroundColor='url(javascript:alert(1))')]),doc([node(fontSize=True)]),doc([node(fontFamily='<script>')])]:
            with self.subTest(data=data):self.assertEqual(self.create(data).status_code,400)
        data=doc([node()]);data['views']['root']['nodes'][0]['style']={'backgroundImage':'url(https://example.test)'}
        self.assertEqual(self.create(data).status_code,400)

    def test_campos_extras_e_ciclos_recusados(self):
        data=doc([node(linkedViewId='root')]);self.assertEqual(self.create(data).status_code,400)
        data=doc([node()]);data['views']['root']['nodes'][0]['dangerouslySetInnerHTML']={'__html':'x'}
        self.assertEqual(self.create(data).status_code,400)

    def test_texto_de_bloco_nao_e_tratado_como_codigo(self):
        response=self.create(doc([node(label='<script>alert(1)</script>')]))
        self.assertEqual(response.status_code,201)
        self.assertEqual(response.data['dados']['views']['root']['nodes'][0]['data']['label'],'<script>alert(1)</script>')

    def test_limite_de_blocos_e_visoes(self):
        self.assertEqual(self.create(doc([node(str(i)) for i in range(5001)])).status_code,400)
        data=doc();data['views'].update({str(i):{'title':'Visão','nodes':[],'edges':[]} for i in range(200)})
        self.assertEqual(self.create(data).status_code,400)

    def test_parser_limita_profundidade_e_constantes_invalidas(self):
        for raw in ['['*70+'0'+']'*70, '{"a": NaN}']:
            response=self.client.post('/api/mapas-mentais/',raw,content_type='application/json')
            self.assertEqual(response.status_code,400)

    def test_versao_invalida_e_ausente_nao_sobrescrevem_mapa(self):
        created=self.create(doc())
        for extra in [{},{'versao':'invalida'}]:
            response=self.client.put(f"/api/mapas-mentais/{created.data['id']}/",{'titulo':'Mapa','dados':created.data['dados'],**extra},format='json')
            self.assertEqual(response.status_code,409)
