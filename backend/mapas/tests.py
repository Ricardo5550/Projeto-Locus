from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import MapaMental


@override_settings(DATA_ENCRYPTION_KEY='6RjRfe5FBjdCRoJ_ZZDOZfIfz8EIQH-EYsPt-1XnFDY=')
class MapaMentalAccessTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user_a = User.objects.create_user('a', 'a@example.com', 'senha123')
        self.user_b = User.objects.create_user('b', 'b@example.com', 'senha123')
        self.client = APIClient()
        self.mapa_a = MapaMental.objects.create(
            titulo='Mapa A', dados={'rootViewId': 'root', 'views': {}}, autor=self.user_a
        )

    def test_sem_autenticacao_retorna_401(self):
        resposta = self.client.get('/api/mapas-mentais/')
        self.assertEqual(resposta.status_code, 401)

    def test_usuario_nao_acessa_mapa_de_outro(self):
        self.client.force_authenticate(self.user_b)
        resposta = self.client.get(f'/api/mapas-mentais/{self.mapa_a.pk}/')
        self.assertEqual(resposta.status_code, 404)

    def test_criacao_define_usuario_como_autor(self):
        self.client.force_authenticate(self.user_b)
        resposta = self.client.post(
            '/api/mapas-mentais/',
            {'titulo': 'Mapa B', 'dados': {'rootViewId': 'root', 'views': {}}},
            format='json',
        )
        self.assertEqual(resposta.status_code, 201)
        self.assertEqual(MapaMental.objects.get(pk=resposta.data['id']).autor, self.user_b)

    def test_dados_ficam_criptografados_no_banco(self):
        from django.db import connection

        mapa = MapaMental.objects.create(
            titulo='Sistema Solar',
            dados={'rootViewId': 'root', 'views': {'root': {'title': 'segredo'}}},
            autor=self.user_a,
        )

        with connection.cursor() as cursor:
            cursor.execute(
                'SELECT dados FROM mapas_mapamental WHERE id = %s',
                [mapa.pk],
            )
            bruto = cursor.fetchone()[0]

        self.assertIsInstance(bruto, str)
        self.assertTrue(bruto.startswith('enc:v1:'))
        self.assertNotIn('segredo', bruto)
        mapa.refresh_from_db()
        self.assertEqual(mapa.dados['rootViewId'], 'root')

    def test_exclusao_do_mapa_e_soft_delete(self):
        self.client.force_authenticate(self.user_a)
        resposta = self.client.delete(f'/api/mapas-mentais/{self.mapa_a.pk}/')
        self.assertEqual(resposta.status_code, 204)
        self.assertFalse(MapaMental.objects.filter(pk=self.mapa_a.pk).exists())
        self.assertTrue(MapaMental.all_objects.filter(pk=self.mapa_a.pk).exists())
