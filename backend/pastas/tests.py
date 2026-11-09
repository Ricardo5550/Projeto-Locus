from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from anotacoes.models import Anotacao
from mapas.models import MapaMental
from revisoes.models import Pergunta, Tentativa
from usuarios.services import anonimizar_e_desativar_conta
from .models import Pasta


class PastaTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user('u', 'u@test.local', 'senha123')
        self.other = get_user_model().objects.create_user('v', 'v@test.local', 'senha123')
        self.folder = Pasta.objects.create(nome='Principal', autor=self.user)
        self.foreign = Pasta.objects.create(nome='Privada', autor=self.other)
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_criar_e_listar_isola_usuario(self):
        response = self.client.post('/api/pastas/', {'nome': 'Filha', 'pai': self.folder.pk}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['autor'], self.user.pk)
        self.assertEqual(len(self.client.get('/api/pastas/').data), 2)

    def test_impede_ciclo_e_destino_de_outro_usuario(self):
        child = Pasta.objects.create(nome='Filha', pai=self.folder, autor=self.user)
        for parent in [child.pk, self.folder.pk, self.foreign.pk]:
            response = self.client.patch(f'/api/pastas/{self.folder.pk}/', {'pai': parent}, format='json')
            self.assertEqual(response.status_code, 400)

    def test_nao_exclui_pasta_com_anotacao(self):
        Anotacao.objects.create(titulo='Teste', conteudo={}, autor=self.user, pasta=self.folder)
        self.assertEqual(self.client.delete(f'/api/pastas/{self.folder.pk}/').status_code, 400)

    def test_nao_exclui_pasta_com_mapa_ou_subpasta(self):
        child = Pasta.objects.create(nome='Filha', pai=self.folder, autor=self.user)
        self.assertEqual(self.client.delete(f'/api/pastas/{self.folder.pk}/').status_code, 400)
        child.delete()
        MapaMental.objects.create(titulo='Mapa', dados={}, autor=self.user, pasta=self.folder)
        self.assertEqual(self.client.delete(f'/api/pastas/{self.folder.pk}/').status_code, 400)

    def test_exclui_pasta_vazia(self):
        self.assertEqual(self.client.delete(f'/api/pastas/{self.folder.pk}/').status_code, 204)
        self.assertFalse(Pasta.objects.filter(pk=self.folder.pk).exists())

    def test_exclusao_confirmada_inclui_subpastas_notas_mapas_e_revisoes(self):
        child = Pasta.objects.create(nome='Filha', pai=self.folder, autor=self.user)
        note = Anotacao.objects.create(titulo='Nota', conteudo={}, autor=self.user, pasta=child)
        question = Pergunta.objects.create(anotacao=note, enunciado='Pergunta', resposta='Resposta')
        attempt = Tentativa.objects.create(pergunta=question, acertou=True)
        mindmap = MapaMental.objects.create(titulo='Mapa', dados={}, autor=self.user, pasta=self.folder)
        outside = Anotacao.objects.create(titulo='Fora', conteudo={}, autor=self.user)
        url = f'/api/pastas/{self.folder.pk}/'
        self.assertEqual(self.client.delete(url).status_code, 400)
        self.assertTrue(Anotacao.objects.filter(pk=note.pk).exists())
        self.assertEqual(self.client.delete(url + '?confirmar_conteudo=true').status_code, 204)
        for model, item in [(Pasta, self.folder), (Pasta, child), (Anotacao, note),
                            (MapaMental, mindmap), (Pergunta, question), (Tentativa, attempt)]:
            self.assertFalse(model.objects.filter(pk=item.pk).exists())
            self.assertIsNotNone(model.all_objects.get(pk=item.pk).deletado_em)
        self.assertTrue(Anotacao.objects.filter(pk=outside.pk).exists())
        self.assertTrue(Pasta.objects.filter(pk=self.foreign.pk).exists())

    def test_exclusao_confirmada_nao_permite_pasta_de_outro_usuario(self):
        response = self.client.delete(f'/api/pastas/{self.foreign.pk}/?confirmar_conteudo=true')
        self.assertEqual(response.status_code, 404)
        self.assertTrue(Pasta.objects.filter(pk=self.foreign.pk).exists())

    def test_mover_nota_valida_autor_e_pasta_ativa(self):
        note = Anotacao.objects.create(titulo='Nota', conteudo={}, autor=self.user)
        url = f'/api/anotacoes/{note.pk}/'
        self.assertEqual(self.client.patch(url, {'pasta': self.foreign.pk}, format='json').status_code, 400)
        self.assertEqual(self.client.patch(url, {'pasta': self.folder.pk}, format='json').status_code, 200)
        self.folder.delete()
        self.assertEqual(self.client.patch(url, {'pasta': self.folder.pk}, format='json').status_code, 400)

    def test_put_do_editor_mantem_pasta(self):
        note = Anotacao.objects.create(titulo='Nota', conteudo={}, autor=self.user, pasta=self.folder)
        self.assertEqual(self.client.put(f'/api/anotacoes/{note.pk}/', {'titulo': 'Editada', 'conteudo': {}}, format='json').status_code, 200)
        note.refresh_from_db()
        self.assertEqual(note.pasta, self.folder)

    def test_exclusao_de_conta_inclui_pastas(self):
        anonimizar_e_desativar_conta(self.user)
        self.assertFalse(Pasta.objects.filter(autor=self.user).exists())
        self.assertTrue(Pasta.objects.filter(autor=self.other).exists())
