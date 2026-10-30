from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from anotacoes.models import Anotacao
from pastas.models import Pasta
from revisoes.models import Pergunta, Tentativa
from .models import MapaMental


def block(**data):
    return {'id': str(data), 'data': data}


def view(title, *nodes):
    return {'title': title, 'nodes': list(nodes), 'edges': []}


class ExclusaoMapaTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user('a', 'a@test.local', 'senha123')
        self.other = get_user_model().objects.create_user('b', 'b@test.local', 'senha123')
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.note = Anotacao.objects.create(titulo='Vida', conteudo={}, autor=self.user)
        self.question = Pergunta.objects.create(anotacao=self.note, enunciado='Q', resposta='R')
        self.attempt = Tentativa.objects.create(pergunta=self.question, acertou=True)
        self.map = MapaMental.objects.create(titulo='Sistema solar', autor=self.user, dados={
            'rootViewId': 'root', 'views': {
                'root': view('Sistema solar', block(label='Terra', linkedViewId='terra'), block(label='Sol', linkedViewId='sol'), block(label='Lua', linkedViewId='lua')),
                'terra': view('Terra', block(label='Vida', linkedAnnotationId=self.note.pk)),
                'sol': view('Sol'), 'lua': view('Lua'),
            }})

    def delete(self, mode):
        return self.client.delete(f'/api/mapas-mentais/{self.map.pk}/?modo={mode}')

    def test_manter_preserva_hierarquia_anotacao_pergunta_e_tentativa(self):
        response = self.delete('manter_anotacoes')
        self.assertEqual(response.status_code, 200)
        root = Pasta.objects.get(pk=response.data['pasta_id'])
        self.assertEqual(root.nome, 'Sistema solar')
        self.assertEqual(set(Pasta.objects.filter(pai=root).values_list('nome', flat=True)), {'Terra', 'Sol', 'Lua'})
        self.note.refresh_from_db()
        self.assertEqual(self.note.pasta.nome, 'Terra')
        self.assertEqual(self.note.pasta.pai, root)
        self.assertTrue(Pergunta.objects.filter(pk=self.question.pk).exists())
        self.assertTrue(Tentativa.objects.filter(pk=self.attempt.pk).exists())
        self.assertFalse(MapaMental.objects.filter(pk=self.map.pk).exists())
        self.assertIsNotNone(MapaMental.all_objects.get(pk=self.map.pk).deletado_em)

    def test_excluir_tudo_aplica_soft_delete_em_cascata(self):
        self.assertEqual(self.delete('excluir_tudo').status_code, 200)
        for model, obj in [(Anotacao, self.note), (Pergunta, self.question), (Tentativa, self.attempt)]:
            self.assertFalse(model.objects.filter(pk=obj.pk).exists())
            self.assertIsNotNone(model.all_objects.get(pk=obj.pk).deletado_em)
        self.assertFalse(Pasta.objects.exists())

    def test_exige_escolha_sem_alterar_dados(self):
        response = self.client.delete(f'/api/mapas-mentais/{self.map.pk}/')
        self.assertEqual(response.status_code, 400)
        self.assertTrue(MapaMental.objects.filter(pk=self.map.pk).exists())

    def test_outro_usuario_nao_exclui(self):
        self.client.force_authenticate(self.other)
        self.assertEqual(self.delete('excluir_tudo').status_code, 404)
        self.assertTrue(Anotacao.objects.filter(pk=self.note.pk).exists())

    def test_referencia_de_outro_usuario_nao_exclui_nem_move_nota(self):
        foreign = Anotacao.objects.create(titulo='Privada', conteudo={}, autor=self.other)
        self.map.dados['views']['root']['nodes'].append(block(linkedAnnotationId=foreign.pk))
        self.map.save()
        self.assertEqual(self.delete('excluir_tudo').status_code, 200)
        foreign.refresh_from_db()
        self.assertIsNone(foreign.deletado_em)
        self.assertIsNone(foreign.pasta)

    def test_nota_usada_por_outro_mapa_nao_e_excluida(self):
        MapaMental.objects.create(titulo='Outro', autor=self.user, dados={'views': {'root': view('Outro', block(linkedAnnotationId=self.note.pk))}})
        self.assertEqual(self.delete('excluir_tudo').status_code, 200)
        self.assertTrue(Anotacao.objects.filter(pk=self.note.pk).exists())

    def test_falha_reverte_pastas_e_exclusao(self):
        with patch('mapas.services.registrar_atividade', side_effect=RuntimeError('Falha simulada')):
            with self.assertRaises(RuntimeError):
                self.delete('manter_anotacoes')
        self.assertFalse(Pasta.objects.exists())
        self.assertTrue(MapaMental.objects.filter(pk=self.map.pk).exists())
        self.note.refresh_from_db()
        self.assertIsNone(self.note.pasta)

    def test_ciclo_e_links_repetidos_nao_duplicam_pastas(self):
        self.map.dados['views']['root']['nodes'].append(block(linkedViewId='terra'))
        self.map.dados['views']['terra']['nodes'].append(block(linkedViewId='root'))
        self.map.save()
        self.assertEqual(self.delete('manter_anotacoes').status_code, 200)
        self.assertEqual(Pasta.objects.count(), 4)

    def test_preserva_visao_orfa_e_nota_na_raiz(self):
        extra = Anotacao.objects.create(titulo='Clima', conteudo={}, autor=self.user)
        self.map.dados['views']['root']['nodes'].append(block(linkedAnnotationId=extra.pk))
        self.map.dados['views']['orfa'] = view('Solo')
        self.map.save()
        response = self.delete('manter_anotacoes')
        extra.refresh_from_db()
        self.assertEqual(extra.pasta_id, response.data['pasta_id'])
        self.assertTrue(Pasta.objects.filter(nome='Solo', pai=extra.pasta).exists())

    def test_conversao_cria_pasta_no_local_do_mapa(self):
        parent = Pasta.objects.create(nome='Ciências', autor=self.user)
        self.map.pasta = parent
        self.map.save()
        response = self.delete('manter_anotacoes')
        self.assertEqual(Pasta.objects.get(pk=response.data['pasta_id']).pai, parent)

    def test_api_recusa_json_sem_visao_principal(self):
        response = self.client.post('/api/mapas-mentais/', {'titulo': 'Inválido', 'dados': {'rootViewId': 'x', 'views': {}}}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_api_recusa_vinculo_com_anotacao_alheia(self):
        foreign = Anotacao.objects.create(titulo='Privada', conteudo={}, autor=self.other)
        data = {'rootViewId': 'r', 'views': {'r': view('Teste', block(linkedAnnotationId=foreign.pk))}}
        response = self.client.post('/api/mapas-mentais/', {'titulo': 'Teste', 'dados': data}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_api_aceita_mapa_valido_e_mantem_pasta_no_put(self):
        parent = Pasta.objects.create(nome='Projetos', autor=self.user)
        data = {'rootViewId': 'r', 'views': {'r': view('Teste', block(linkedAnnotationId=self.note.pk))}}
        created = self.client.post('/api/mapas-mentais/', {'titulo': 'Teste', 'dados': data, 'pasta': parent.pk}, format='json')
        self.assertEqual(created.status_code, 201)
        response = self.client.put(f"/api/mapas-mentais/{created.data['id']}/", {'titulo': 'Editado', 'dados': data}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['pasta'], parent.pk)

    def test_nota_compartilhada_nao_e_movida_ao_preservar(self):
        original = Pasta.objects.create(nome='Compartilhadas', autor=self.user)
        self.note.pasta = original
        self.note.save()
        MapaMental.objects.create(titulo='Outro', autor=self.user, dados={'views': {'root': view('Outro', block(linkedAnnotationId=self.note.pk))}})
        self.assertEqual(self.delete('manter_anotacoes').status_code, 200)
        self.note.refresh_from_db()
        self.assertEqual(self.note.pasta, original)
