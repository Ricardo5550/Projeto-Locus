from uuid import uuid4

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase
from rest_framework.test import APIClient

from anotacoes.models import Anotacao
from mapas.models import MapaMental
from pastas.models import Pasta

from .models import Pergunta, Questionario, SessaoRevisao
from .questionarios import QuestionarioViewSet


class QuestionarioOrigemTests(TestCase):
    def setUp(self):
        self.usuario = get_user_model().objects.create_user(username='aluno-origem')
        self.client = APIClient()
        self.client.force_authenticate(self.usuario)

    def nota(self, titulo, pasta=None):
        return Anotacao.objects.create(autor=self.usuario, titulo=titulo, pasta=pasta)

    def criar_pergunta(self, nota, **campos):
        return self.client.post('/api/perguntas/', {
            'anotacao': nota.pk, 'enunciado': 'Qual é a resposta?', 'resposta': 'Esta.',
            **campos,
        }, format='json')

    def test_anotacoes_avulsas_de_mesmo_nome_tem_questionarios_distintos(self):
        primeira = self.nota('Fotossíntese')
        segunda = self.nota('Fotossíntese')
        criada = self.criar_pergunta(primeira)
        self.assertEqual(criada.status_code, 201, criada.data)
        self.assertEqual(self.criar_pergunta(primeira).data['questionario'], criada.data['questionario'])
        outra = self.criar_pergunta(segunda)
        self.assertNotEqual(outra.data['questionario'], criada.data['questionario'])
        self.assertEqual(list(Questionario.objects.values_list('titulo', flat=True)), ['Fotossíntese'] * 2)

    def test_anotacoes_na_mesma_pasta_compartilham_questionario(self):
        pasta = Pasta.objects.create(autor=self.usuario, nome='Biologia')
        outra = Pasta.objects.create(autor=self.usuario, nome=pasta.nome)
        ids = [self.criar_pergunta(self.nota(nome, destino)).data['questionario']
               for nome, destino in [('Vida', pasta), ('Células', pasta), ('Bactérias', outra)]]
        self.assertEqual(ids[0], ids[1])
        self.assertNotEqual(ids[0], ids[2])
        self.assertEqual(Questionario.objects.get(pk=ids[0]).titulo, 'Biologia')

    def test_visao_interna_do_mapa_tem_precedencia_sobre_pasta(self):
        pasta = Pasta.objects.create(autor=self.usuario, nome='Biologia')
        nota = self.nota('Vida', pasta)
        raiz = self.nota('Planetas')
        mapa = MapaMental.objects.create(autor=self.usuario, titulo='Sistema Solar', dados={
            'rootViewId': 'raiz', 'views': {
                'raiz': {'title': 'Sistema Solar', 'nodes': [{'data': {'linkedAnnotationId': raiz.pk}}]},
                'terra': {'title': 'Terra', 'nodes': [{'data': {'linkedAnnotationId': nota.pk}}]},
            },
        })
        criada = self.criar_pergunta(nota, mapa_origem=mapa.pk, visao_origem='terra')
        self.assertEqual(criada.status_code, 201, criada.data)
        self.assertEqual(Questionario.objects.get(pk=criada.data['questionario']).titulo, 'Terra')
        self.assertEqual(self.criar_pergunta(nota).data['questionario'], criada.data['questionario'])
        self.assertEqual(self.criar_pergunta(nota, mapa_origem=mapa.pk, visao_origem='raiz').status_code, 400)
        na_raiz = self.criar_pergunta(raiz, mapa_origem=mapa.pk)
        self.assertEqual(Questionario.objects.get(pk=na_raiz.data['questionario']).titulo, 'Sistema Solar')

    def test_finalizar_questionario_sem_materia_ou_pasta_e_confirmar_nova_pergunta(self):
        nota = self.nota('Estudos')
        pergunta = self.criar_pergunta(nota).data
        q = Questionario.objects.get(pk=pergunta['questionario'])
        url = f'/api/questionarios/{q.pk}/'
        finalizada = self.client.post(url + 'finalizar/', {
            'chave': str(uuid4()), 'versao': q.versao, 'respostas': [
                {'pergunta': pergunta['id'], 'resposta_digitada': '', 'resultado': 'acertei'},
            ],
        }, format='json')
        self.assertEqual(finalizada.status_code, 201, finalizada.data)
        self.assertEqual(self.criar_pergunta(nota).status_code, 409)
        self.assertEqual(Pergunta.objects.count(), 1)
        self.assertEqual(self.criar_pergunta(nota, confirmar_reinicio=True).status_code, 201)
        self.assertEqual(SessaoRevisao.objects.count(), 1)
        self.assertEqual(self.client.patch(url, {'titulo': 'Revisão', 'limite_dias': 14}, format='json').status_code, 200)
        resultados = self.client.get('/api/resultados/', {'agrupamento': 'questionario', 'questionario': q.pk})
        self.assertEqual(resultados.data['barras'][0]['nome'], 'Revisão')

    def test_operacoes_de_escrita_bloqueiam_sem_juncoes_opcionais(self):
        view = QuestionarioViewSet()
        view.request = type('Request', (), {'user': self.usuario})()
        for acao in ('finalizar', 'update', 'partial_update', 'destroy'):
            view.action = acao
            consulta = view.get_queryset()
            self.assertTrue(consulta.query.select_for_update)
            sql = consulta.query.get_compiler(connection=connection).as_sql()[0]
            self.assertNotIn('JOIN', sql)

    def test_transferir_preserva_vinculos_e_devolutiva_e_reinicia_ambos(self):
        nota = self.nota('Origem')
        pergunta = self.criar_pergunta(nota).data
        origem = Questionario.objects.get(pk=pergunta['questionario'])
        destino = Questionario.objects.create(autor=self.usuario, titulo='Destino', sucessos=3, intervalo=14)
        dados = {
            'chave': str(uuid4()), 'versao': origem.versao, 'respostas': [
                {'pergunta': pergunta['id'], 'resposta_digitada': 'Minha resposta', 'resultado': 'parcial'},
            ],
        }
        url_origem = f'/api/questionarios/{origem.pk}/'
        self.assertEqual(self.client.post(url_origem + 'finalizar/', dados, format='json').status_code, 201)
        origem.refresh_from_db()
        url_pergunta = f"/api/perguntas/{pergunta['id']}/"
        campos = {'questionario': destino.pk, 'enunciado': 'Enunciado ajustado'}
        self.assertEqual(self.client.patch(url_pergunta, campos, format='json').status_code, 400)
        resposta = self.client.patch(url_pergunta, {**campos, 'confirmar_reinicio': True}, format='json')
        self.assertEqual(resposta.status_code, 200, resposta.data)
        self.assertEqual((resposta.data['id'], resposta.data['anotacao'], resposta.data['questionario']),
                         (pergunta['id'], nota.pk, destino.pk))
        versao_anterior = origem.versao
        origem.refresh_from_db()
        destino.refresh_from_db()
        self.assertEqual((origem.versao, destino.versao), (versao_anterior + 1, 2))
        self.assertIsNone(origem.proxima_revisao)
        self.assertEqual((origem.sucessos, destino.sucessos, destino.intervalo), (0, 0, 0))
        devolutiva = self.client.get(url_origem + 'devolutiva/').data
        self.assertEqual(devolutiva['respostas'][0]['enunciado'], 'Qual é a resposta?')

    def test_transferir_para_questionario_de_outra_conta_falha(self):
        pergunta = self.criar_pergunta(self.nota('Origem')).data
        outro = get_user_model().objects.create_user(username='outra-conta-transferencia')
        destino = Questionario.objects.create(autor=outro, titulo='Privado')
        resposta = self.client.patch(f"/api/perguntas/{pergunta['id']}/", {
            'questionario': destino.pk, 'confirmar_reinicio': True,
        }, format='json')
        self.assertEqual(resposta.status_code, 400)
        self.assertEqual(Pergunta.objects.get(pk=pergunta['id']).questionario_id, pergunta['questionario'])
