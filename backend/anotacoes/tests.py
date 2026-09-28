from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import Anotacao


@override_settings(DATA_ENCRYPTION_KEY='6RjRfe5FBjdCRoJ_ZZDOZfIfz8EIQH-EYsPt-1XnFDY=')
class AnotacaoAccessTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user_a = User.objects.create_user('a', 'a@example.com', 'senha123')
        self.user_b = User.objects.create_user('b', 'b@example.com', 'senha123')
        self.client = APIClient()
        self.anotacao_a = Anotacao.objects.create(
            titulo='Privada A', conteudo={}, autor=self.user_a
        )

    def test_sem_autenticacao_retorna_401(self):
        resposta = self.client.get('/api/anotacoes/')
        self.assertEqual(resposta.status_code, 401)

    def test_usuario_nao_acessa_anotacao_de_outro(self):
        self.client.force_authenticate(self.user_b)
        resposta = self.client.get(f'/api/anotacoes/{self.anotacao_a.pk}/')
        self.assertEqual(resposta.status_code, 404)

    def test_criacao_define_usuario_como_autor(self):
        self.client.force_authenticate(self.user_b)
        resposta = self.client.post(
            '/api/anotacoes/',
            {'titulo': 'Minha nota', 'conteudo': {}, 'autor': self.user_a.pk},
            format='json',
        )
        self.assertEqual(resposta.status_code, 201)
        self.assertEqual(Anotacao.objects.get(pk=resposta.data['id']).autor, self.user_b)

    def test_texto_com_sintaxe_sql_e_tratado_como_dado(self):
        self.client.force_authenticate(self.user_a)
        titulo = "x'); DROP TABLE anotacoes_anotacao; --"
        resposta = self.client.post(
            '/api/anotacoes/',
            {'titulo': titulo, 'conteudo': {}},
            format='json',
        )
        self.assertEqual(resposta.status_code, 201)
        self.assertTrue(Anotacao.objects.filter(titulo=titulo).exists())
        self.assertTrue(Anotacao.objects.filter(pk=self.anotacao_a.pk).exists())

    def test_conteudo_fica_criptografado_no_banco(self):
        from django.db import connection

        anotacao = Anotacao.objects.create(
            titulo='Segredo',
            conteudo={'type': 'doc', 'content': [{'type': 'text', 'text': 'conteudo reservado'}]},
            autor=self.user_a,
        )

        with connection.cursor() as cursor:
            cursor.execute(
                'SELECT conteudo FROM anotacoes_anotacao WHERE id = %s',
                [anotacao.pk],
            )
            bruto = cursor.fetchone()[0]

        self.assertIsInstance(bruto, str)
        self.assertTrue(bruto.startswith('enc:v1:'))
        self.assertNotIn('conteudo reservado', bruto)
        anotacao.refresh_from_db()
        self.assertEqual(anotacao.conteudo['type'], 'doc')

    def test_exclusao_da_anotacao_e_soft_delete(self):
        self.client.force_authenticate(self.user_a)
        resposta = self.client.delete(f'/api/anotacoes/{self.anotacao_a.pk}/')
        self.assertEqual(resposta.status_code, 204)
        self.assertFalse(Anotacao.objects.filter(pk=self.anotacao_a.pk).exists())
        self.assertTrue(Anotacao.all_objects.filter(pk=self.anotacao_a.pk).exists())
