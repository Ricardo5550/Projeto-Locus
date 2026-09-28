from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from anotacoes.models import Anotacao
from .models import Pergunta, Tentativa


@override_settings(DATA_ENCRYPTION_KEY='6RjRfe5FBjdCRoJ_ZZDOZfIfz8EIQH-EYsPt-1XnFDY=')
class FluxoQuestionarioTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user_a = User.objects.create_user('a', 'a@example.com', 'senha123')
        self.user_b = User.objects.create_user('b', 'b@example.com', 'senha123')
        self.client = APIClient()
        self.anotacao_a = Anotacao.objects.create(
            titulo='Biologia', conteudo={'type': 'doc', 'content': []}, autor=self.user_a
        )

    def test_usuario_nao_cria_pergunta_em_anotacao_de_outro(self):
        self.client.force_authenticate(self.user_b)
        resposta = self.client.post('/api/perguntas/', {
            'anotacao': self.anotacao_a.pk,
            'enunciado': 'Pergunta',
            'resposta': 'Resposta',
            'trecho_origem': 'Trecho',
        }, format='json')
        self.assertEqual(resposta.status_code, 400)

    def test_usuario_nao_enxerga_pergunta_de_outro(self):
        pergunta = Pergunta.objects.create(
            anotacao=self.anotacao_a, enunciado='Q', resposta='R'
        )
        self.client.force_authenticate(self.user_b)
        resposta = self.client.get(f'/api/perguntas/{pergunta.pk}/')
        self.assertEqual(resposta.status_code, 404)

    def test_fluxo_do_proprio_usuario(self):
        self.client.force_authenticate(self.user_a)
        criada = self.client.post('/api/perguntas/', {
            'anotacao': self.anotacao_a.pk,
            'enunciado': 'O que é mitose?',
            'resposta': 'Divisão celular.',
            'trecho_origem': 'Mitose',
        }, format='json')
        self.assertEqual(criada.status_code, 201)

        tentativa = self.client.post('/api/tentativas/', {
            'pergunta': criada.data['id'],
            'resposta_digitada': 'Divisão celular',
            'acertou': True,
        }, format='json')
        self.assertEqual(tentativa.status_code, 201)
        self.assertTrue(Tentativa.objects.get(pk=tentativa.data['id']).acertou)

    def test_exclusao_da_pergunta_e_soft_delete(self):
        pergunta = Pergunta.objects.create(
            anotacao=self.anotacao_a, enunciado='Excluir?', resposta='Sim'
        )
        self.client.force_authenticate(self.user_a)
        resposta = self.client.delete(f'/api/perguntas/{pergunta.pk}/')
        self.assertEqual(resposta.status_code, 204)
        self.assertFalse(Pergunta.objects.filter(pk=pergunta.pk).exists())
        self.assertTrue(Pergunta.all_objects.filter(pk=pergunta.pk).exists())
