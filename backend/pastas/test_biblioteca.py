from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from anotacoes.models import Anotacao
from mapas.models import MapaMental
from revisoes.models import Materia, Questionario

from .models import Pasta


class PaginacaoTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.usuario = get_user_model().objects.create_user(username='biblioteca')
        cls.outro = get_user_model().objects.create_user(username='outra-conta')

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.usuario)

    def test_biblioteca_pagina_metadados_e_aplica_busca_antes_do_recorte(self):
        pasta = Pasta.objects.create(autor=self.usuario, nome='Última pasta')
        Questionario.objects.create(autor=self.usuario, titulo='Questionário na pasta', pasta=pasta)
        MapaMental.objects.create(autor=self.usuario, titulo='Mapa da pasta', pasta=pasta)
        for numero in range(21):
            Anotacao.objects.create(autor=self.usuario, titulo=f'Nota {numero:02}', conteudo={'texto': 'privado'})
        Anotacao.objects.create(autor=self.outro, titulo='Nota 21')
        nota_excluida = Anotacao.objects.create(autor=self.usuario, titulo='Nota 22')
        nota_excluida.delete()

        primeira = self.client.get('/api/biblioteca/')
        self.assertEqual(primeira.status_code, 200, primeira.data)
        self.assertEqual((primeira.data['total'], primeira.data['total_paginas']), (22, 2))
        self.assertEqual(len(primeira.data['itens']), 20)
        self.assertEqual(primeira.data['itens'][0]['type'], 'Pasta')
        self.assertTrue(primeira.data['itens'][0]['hasContent'])
        self.assertEqual(set(primeira.data['itens'][1]), {
            'id', 'type', 'title', 'folder', 'updatedAt', 'hasContent',
        })

        segunda = self.client.get('/api/biblioteca/', {'pagina': 2}).data
        self.assertEqual([item['title'] for item in segunda['itens']], ['Nota 19', 'Nota 20'])
        busca = self.client.get('/api/biblioteca/', {'busca': 'nota 20'}).data
        self.assertEqual((busca['total'], busca['total_paginas']), (1, 1))
        conteudo = self.client.get('/api/biblioteca/', {'pasta': pasta.pk}).data
        self.assertEqual([item['title'] for item in conteudo['itens']], ['Mapa da pasta'])

    def test_biblioteca_oculta_anotacao_vinculada_e_rejeita_pasta_de_outra_conta(self):
        nota = Anotacao.objects.create(autor=self.usuario, titulo='Anotação do mapa')
        pasta = Pasta.objects.create(autor=self.usuario, nome='Pasta do mapa')
        mapa = MapaMental.objects.create(
            autor=self.usuario, pasta=pasta, titulo='Mapa',
            dados={'views': {'raiz': {'nodes': [{'data': {'linkedAnnotationId': nota.pk}}]}}},
        )
        pasta_privada = Pasta.objects.create(autor=self.outro, nome='Privada')
        self.assertEqual(self.client.get('/api/biblioteca/', {'pasta': pasta_privada.pk}).status_code, 404)
        self.assertEqual(self.client.get('/api/biblioteca/', {'busca': 'Anotação'}).data['total'], 0)
        mapa.delete()
        self.assertEqual(self.client.get('/api/biblioteca/', {'busca': 'Anotação'}).data['total'], 1)

    def test_questionarios_paginam_filtram_e_recuam_apos_exclusao(self):
        pasta = Pasta.objects.create(autor=self.usuario, nome='Estudos')
        materia = Materia.objects.create(autor=self.usuario, nome='História')
        ontem = timezone.localdate() - timedelta(days=1)
        for numero in range(20):
            Questionario.objects.create(autor=self.usuario, titulo=f'Questionário {numero:02}')
        ultimo = Questionario.objects.create(
            autor=self.usuario, titulo='Questionário 20', materia=materia, pasta=pasta,
            proxima_revisao=ontem, ultima_revisao=timezone.now() - timedelta(days=1),
        )
        Questionario.objects.create(autor=self.outro, titulo='Questionário 21')
        rota = '/api/questionarios/paginados/'

        primeira = self.client.get(rota)
        self.assertEqual(primeira.status_code, 200, primeira.data)
        self.assertEqual((primeira.data['total'], primeira.data['total_paginas']), (21, 2))
        self.assertEqual(len(primeira.data['itens']), 20)
        segunda = self.client.get(rota, {'pagina': 2}).data
        self.assertEqual([item['id'] for item in segunda['itens']], [ultimo.pk])
        filtros = {'materia': materia.pk, 'pasta': pasta.pk, 'busca': '20', 'situacao': 'atrasadas'}
        filtrados = self.client.get(rota, filtros).data
        self.assertEqual([item['id'] for item in filtrados['itens']], [ultimo.pk])
        self.assertEqual(self.client.get(rota, {**filtros, 'situacao': 'novos'}).data['total'], 0)
        self.assertEqual(len(self.client.get('/api/questionarios/').data), 21)
        ultimo.delete()
        pagina = self.client.get(rota, {'pagina': 2}).data
        self.assertEqual((pagina['pagina'], pagina['total_paginas']), (1, 1))
