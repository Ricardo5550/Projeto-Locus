"""Testes sem chamadas reais à Crossref."""

import json
from io import BytesIO
from unittest.mock import patch
from urllib.error import URLError

from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory

from .services import CrossrefIndisponivel, pesquisar_crossref
from .views import buscar_referencias


class _Resposta(BytesIO):
    pass


class CrossrefServiceTests(SimpleTestCase):
    @patch('referencias.services.urlopen')
    def test_normaliza_resultados(self, abrir):
        dados = {'message': {'items': [{
            'DOI': '10.1234/abc', 'title': ['Artigo teste'],
            'author': [{'given': 'Ana', 'family': 'Silva'}],
            'published': {'date-parts': [[2024, 3, 1]]},
            'container-title': ['Revista exemplo'],
        }]}}
        abrir.return_value = _Resposta(json.dumps(dados).encode('utf-8'))
        resultado = pesquisar_crossref('Artigo teste')[0]
        self.assertEqual(resultado['titulo'], 'Artigo teste')
        self.assertEqual(resultado['autores'], ['Ana Silva'])
        self.assertEqual(resultado['ano'], 2024)
        self.assertEqual(resultado['doi'], '10.1234/abc')

    @patch('referencias.services.urlopen', side_effect=URLError('sem rede'))
    def test_indisponibilidade(self, _abrir):
        with self.assertRaises(CrossrefIndisponivel):
            pesquisar_crossref('Artigo teste')


class CrossrefEndpointTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    def test_pesquisa_vazia(self):
        resposta = buscar_referencias(self.factory.get('/api/referencias/'))
        self.assertEqual(resposta.status_code, 400)

    @patch('referencias.views.cache.get', return_value=None)
    @patch('referencias.views.cache.set')
    @patch('referencias.views.pesquisar_crossref', return_value=[{'titulo': 'Teste'}])
    def test_consulta_sucesso(self, pesquisar, _salvar, _obter):
        resposta = buscar_referencias(self.factory.get('/api/referencias/?q=teste'))
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.data['resultados'][0]['titulo'], 'Teste')
        pesquisar.assert_called_once_with('teste')

    @patch('referencias.views.cache.get', return_value=None)
    @patch('referencias.views.pesquisar_crossref', side_effect=CrossrefIndisponivel())
    def test_api_indisponivel(self, _pesquisar, _cache):
        resposta = buscar_referencias(self.factory.get('/api/referencias/?q=teste'))
        self.assertEqual(resposta.status_code, 503)
