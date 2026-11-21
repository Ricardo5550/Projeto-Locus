from uuid import UUID, uuid4
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient
from anotacoes.models import Anotacao
from mapas.models import MapaMental
from revisoes.models import Pergunta, Questionario


class FluxoUUIDTests(TestCase):
    def setUp(self):
        cache.clear()
        self.usuario = get_user_model().objects.create_user('aluno_uuid')
        self.client = APIClient()
        self.client.force_authenticate(self.usuario)

    def test_mapa_vincula_anotacao_e_sincroniza_titulo(self):
        anotacao = Anotacao.objects.create(autor=self.usuario, titulo='Sol')
        dados = {
            'rootViewId': 'root',
            'views': {
                'root': {
                    'title': 'Sistema solar',
                    'edges': [],
                    'nodes': [
                        {
                            'id': 'bloco-sol',
                            'position': {'x': 0, 'y': 0},
                            'data': {
                                'label': 'Sol',
                                'linkedContentType': 'annotation',
                                'linkedAnnotationId': str(anotacao.pk),
                            },
                        }
                    ],
                }
            },
        }
        resposta = self.client.post(
            '/api/mapas-mentais/',
            {
                'titulo': 'Sistema solar',
                'dados': dados,
            },
            format='json',
        )
        self.assertEqual(resposta.status_code, 201, resposta.data)
        mapa_id = resposta.data['id']
        self.assertEqual(str(UUID(mapa_id)), mapa_id)
        self.assertEqual(
            self.client.patch(
                f'/api/anotacoes/{anotacao.pk}/',
                {
                    'titulo': 'Nossa estrela',
                },
                format='json',
            ).status_code,
            200,
        )
        mapa = MapaMental.objects.get(pk=mapa_id)
        bloco = mapa.dados['views']['root']['nodes'][0]['data']
        self.assertEqual(bloco['label'], 'Nossa estrela')
        self.assertEqual(bloco['linkedAnnotationId'], str(anotacao.pk))

    def test_devolutiva_preserva_uuid_e_link_disponivel(self):
        anotacao = Anotacao.objects.create(autor=self.usuario, titulo='Sol')
        questionario = Questionario.objects.create(
            autor=self.usuario, titulo='Astronomia'
        )
        pergunta = Pergunta.objects.create(
            anotacao=anotacao,
            questionario=questionario,
            enunciado='O que é o Sol?',
            resposta='Uma estrela',
        )
        resposta = self.client.post(
            f'/api/questionarios/{questionario.pk}/finalizar/',
            {
                'chave': str(uuid4()),
                'versao': 1,
                'respostas': [
                    {
                        'pergunta': str(pergunta.pk),
                        'resposta_digitada': '',
                        'resultado': 'errei',
                    }
                ],
            },
            format='json',
        )
        self.assertEqual(resposta.status_code, 201, resposta.data)
        devolutiva = self.client.get(
            f'/api/questionarios/{questionario.pk}/devolutiva/'
        ).json()
        self.assertEqual(devolutiva['respostas'][0]['anotacao'], str(anotacao.pk))
        self.assertTrue(devolutiva['respostas'][0]['anotacao_disponivel'])

    def test_filtros_invalidos_retornam_400(self):
        for url in [
            '/api/biblioteca/?pasta=invalido',
            '/api/perguntas/?questionario=invalido',
            '/api/resultados/?questionario=invalido',
            '/api/resultados/?inicio=2026-11-14&fim=2026-11-01',
        ]:
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 400)
