from django.test import TestCase
from rest_framework.test import APIClient

from anotacoes.models import Anotacao
from .models import Pergunta, Tentativa


class FluxoQuestionarioTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.anotacao = Anotacao.objects.create(
            titulo='Biologia', conteudo={'type': 'doc', 'content': []}
        )

    def test_criacao_pergunta_e_registro_tentativa(self):
        criada = self.client.post('/api/perguntas/', {
            'anotacao': self.anotacao.pk,
            'enunciado': 'O que é mitose?',
            'resposta': 'Divisão celular.',
            'trecho_origem': 'Mitose',
        }, format='json')
        self.assertEqual(criada.status_code, 201)
        pergunta = Pergunta.objects.get(pk=criada.data['id'])
        self.assertEqual(pergunta.anotacao, self.anotacao)

        tentativa = self.client.post('/api/tentativas/', {
            'pergunta': pergunta.pk,
            'resposta_digitada': 'Divisão celular',
            'acertou': True,
        }, format='json')
        self.assertEqual(tentativa.status_code, 201)
        self.assertTrue(Tentativa.objects.get(pk=tentativa.data['id']).acertou)

    def test_pergunta_sem_resposta_nao_pode_ser_salva(self):
        resposta = self.client.post('/api/perguntas/', {
            'anotacao': self.anotacao.pk,
            'enunciado': 'Pergunta de teste',
            'resposta': '   ',
        }, format='json')
        self.assertEqual(resposta.status_code, 400)

    def test_excluir_anotacao_remove_perguntas_e_tentativas(self):
        pergunta = Pergunta.objects.create(anotacao=self.anotacao, enunciado='Q', resposta='R')
        Tentativa.objects.create(pergunta=pergunta, acertou=False)
        self.anotacao.delete()
        self.assertFalse(Pergunta.objects.filter(pk=pergunta.pk).exists())
        self.assertEqual(Tentativa.objects.count(), 0)
