from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from acompanhamento.models import AnotacaoCompartilhada, EspacoAcompanhamento, Participacao, PerfilTutor
from anotacoes.models import Anotacao


class ConversasAcompanhamentoTests(TestCase):
    def setUp(self):
        usuarios = get_user_model().objects
        self.aluno = usuarios.create_user(username='aluna')
        self.tutor = usuarios.create_user(username='tutor')
        self.segundo_tutor = usuarios.create_user(username='segundo')
        self.terceiro = usuarios.create_user(username='terceiro')
        self.espaco = EspacoAcompanhamento.objects.create(proprietario=self.aluno, nome='Estudos')
        for usuario in (self.tutor, self.segundo_tutor):
            perfil = PerfilTutor.objects.create(usuario=usuario, nome_apresentacao=usuario.username)
            Participacao.objects.create(espaco=self.espaco, tutor=perfil)
        self.duvidas = reverse('acompanhamento-duvidas', args=[self.espaco.pk])
        self.api = APIClient()

    def test_duvida_e_resposta_visiveis_aos_dois_tutores(self):
        self.api.force_authenticate(self.aluno)
        duvida = self.api.post(self.duvidas, {'texto': 'Como revisar este assunto?'}, format='json')
        self.assertEqual(duvida.status_code, 201)
        self.api.force_authenticate(self.tutor)
        resposta = self.api.post(self.duvidas, {
            'texto': 'Tente resolver os exercícios.', 'resposta_a': duvida.data['id'],
        }, format='json')
        self.assertEqual(resposta.status_code, 201)
        self.assertEqual(self.api.post(self.duvidas, {'texto': 'Outra dúvida'}, format='json').status_code, 403)

        self.api.force_authenticate(self.segundo_tutor)
        self.assertEqual(self.api.get(self.duvidas).data, [duvida.data, resposta.data])
        Participacao.objects.filter(espaco=self.espaco, tutor__usuario=self.segundo_tutor).update(ativo=False)
        self.assertEqual(self.api.get(self.duvidas).status_code, 403)
        self.api.force_authenticate(self.terceiro)
        self.assertEqual(self.api.get(self.duvidas).status_code, 403)

    def test_comentarios_exigem_material_compartilhado_no_espaco(self):
        anotacao = Anotacao.objects.create(autor=self.aluno, titulo='Assunto', conteudo={})
        comentarios = reverse('acompanhamento-comentarios', args=[self.espaco.pk, 'anotacao', anotacao.pk])
        self.api.force_authenticate(self.tutor)
        self.assertEqual(self.api.get(comentarios).status_code, 404)

        AnotacaoCompartilhada.objects.create(espaco=self.espaco, anotacao=anotacao)
        comentario = self.api.post(comentarios, {'texto': 'Confira esta definição.'}, format='json')
        self.assertEqual(comentario.status_code, 201)
        self.api.force_authenticate(self.aluno)
        self.assertEqual(self.api.get(comentarios).data, [{**comentario.data, 'pode_gerenciar': False}])
        self.assertEqual(self.api.post(self.duvidas, {
            'texto': 'Resposta no canal errado', 'resposta_a': comentario.data['id'],
        }, format='json').status_code, 404)

    def test_perfil_privado_fora_da_pesquisa_com_convite_direto(self):
        perfil = PerfilTutor.objects.create(
            usuario=self.terceiro, nome_apresentacao='Tutor de Tecnologia', area='tecnologia',
        )
        self.api.force_authenticate(self.aluno)
        pesquisa = reverse('acompanhamento-tutores-disponiveis')
        self.assertEqual(self.api.get(pesquisa, {'busca': 'Tecnologia'}).data, [])
        convite = self.api.post(reverse('acompanhamento-convite-criar'), {
            'espaco_id': self.espaco.pk, 'usuario_tutor': self.terceiro.username,
        }, format='json')
        self.assertEqual(convite.status_code, 201)
        perfil.visibilidade = 'publico'
        perfil.save(update_fields=['visibilidade'])
        self.assertEqual(self.api.get(pesquisa, {'busca': 'Tecnologia'}).data[0]['area'], 'tecnologia')

    def test_formacoes_opcionais_por_item_e_exibidas_na_busca(self):
        self.api.force_authenticate(self.terceiro)
        url = reverse('acompanhamento-perfil-tutor')
        criado = self.api.post(url, {
            'nome_apresentacao': 'Tutor de Tecnologia', 'visibilidade': 'publico',
        }, format='json')
        self.assertEqual(criado.status_code, 201)
        self.assertEqual(criado.data['formacoes'], [])

        invalido = self.api.patch(url, {'formacoes': [{'instituicao': 'Faculdade'}]}, format='json')
        self.assertEqual(invalido.status_code, 400)
        invalido = self.api.patch(url, {'formacoes': [{
            'titulo': 'Tecnologia', 'link_comprovante': 'ftp://example.com/certificado',
        }]}, format='json')
        self.assertEqual(invalido.status_code, 400)
        atualizado = self.api.patch(url, {'formacoes': [
            {'titulo': 'Graduação em Computação', 'instituicao': 'Faculdade'},
            {'titulo': 'Curso de Redes', 'link_comprovante': 'https://example.com/certificado'},
        ]}, format='json')
        self.assertEqual(atualizado.status_code, 200)
        self.assertEqual(atualizado.data['formacoes'], [
            {'titulo': 'Graduação em Computação', 'instituicao': 'Faculdade', 'link_comprovante': ''},
            {'titulo': 'Curso de Redes', 'instituicao': '', 'link_comprovante': 'https://example.com/certificado'},
        ])

        self.api.force_authenticate(self.aluno)
        encontrados = self.api.get(reverse('acompanhamento-tutores-disponiveis'), {'busca': 'Tecnologia'})
        self.assertEqual(encontrados.data[0]['formacoes'], atualizado.data['formacoes'])
        self.api.force_authenticate(self.terceiro)
        removido = self.api.patch(url, {'formacoes': []}, format='json')
        self.assertEqual(removido.data['formacoes'], [])

    def test_somente_dono_renomeia_e_exclui_canal_sem_apagar_materiais(self):
        url = reverse('acompanhamento-canal-detalhe', args=[self.espaco.pk])
        anotacao = Anotacao.objects.create(autor=self.aluno, titulo='Assunto', conteudo={})
        AnotacaoCompartilhada.objects.create(espaco=self.espaco, anotacao=anotacao)

        self.api.force_authenticate(self.tutor)
        self.assertEqual(self.api.patch(url, {'nome': 'Outro nome'}, format='json').status_code, 404)
        self.assertEqual(self.api.delete(url).status_code, 404)

        self.api.force_authenticate(self.aluno)
        self.assertEqual(self.api.patch(url, {'nome': '  '}, format='json').status_code, 400)
        resposta = self.api.patch(url, {'nome': ' Novo nome '}, format='json')
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.data['nome'], 'Novo nome')
        self.assertEqual(self.api.delete(url).status_code, 204)
        self.assertTrue(Anotacao.objects.filter(pk=anotacao.pk).exists())
        self.assertFalse(Participacao.objects.filter(espaco=self.espaco).exists())
        self.assertEqual(self.api.get(self.duvidas).status_code, 404)

    def test_nota_vinculada_exige_mapa_compartilhado_e_tutor_ativo_no_canal(self):
        from acompanhamento.models import MapaCompartilhado
        from mapas.models import MapaMental

        nota = Anotacao.objects.create(autor=self.aluno, titulo='Vinculada', conteudo={})
        outra = Anotacao.objects.create(autor=self.aluno, titulo='Não vinculada', conteudo={})
        mapa = MapaMental.objects.create(autor=self.aluno, titulo='Mapa', dados={
            'views': {'filho': {'nodes': [{'data': {'linkedAnnotationId': nota.pk}}]}},
        })
        url = reverse('acompanhamento-anotacao-vinculada', args=[self.espaco.pk, mapa.pk, nota.pk])
        self.api.force_authenticate(self.tutor)
        self.assertEqual(self.api.get(url).status_code, 404)
        MapaCompartilhado.objects.create(espaco=self.espaco, mapa=mapa)
        self.assertEqual(self.api.get(url).data['titulo'], 'Vinculada')
        outra_url = reverse('acompanhamento-anotacao-vinculada', args=[self.espaco.pk, mapa.pk, outra.pk])
        self.assertEqual(self.api.get(outra_url).status_code, 404)
        self.api.force_authenticate(self.terceiro)
        self.assertEqual(self.api.get(url).status_code, 403)
        Participacao.objects.filter(espaco=self.espaco, tutor__usuario=self.tutor).update(ativo=False)
        self.api.force_authenticate(self.tutor)
        self.assertEqual(self.api.get(url).status_code, 403)

    def test_autor_edita_e_exclui_comentario_preservando_respostas(self):
        anotacao = Anotacao.objects.create(autor=self.aluno, titulo='Assunto', conteudo={})
        AnotacaoCompartilhada.objects.create(espaco=self.espaco, anotacao=anotacao)
        args = [self.espaco.pk, 'anotacao', anotacao.pk]
        comentarios = reverse('acompanhamento-comentarios', args=args)
        self.api.force_authenticate(self.tutor)
        criado = self.api.post(comentarios, {'texto': 'Primeira versão'}, format='json')
        self.assertTrue(criado.data['pode_gerenciar'])
        comentario_id = criado.data['id']
        detalhe = reverse('acompanhamento-comentario-detalhe', args=[*args, comentario_id])
        self.assertEqual(self.api.patch(detalhe, {'texto': '  '}, format='json').status_code, 400)
        self.assertEqual(self.api.patch(detalhe, {'texto': 'Texto revisado'}, format='json').data['texto'], 'Texto revisado')

        self.api.force_authenticate(self.aluno)
        self.assertEqual(self.api.patch(detalhe, {'texto': 'Alteração indevida'}, format='json').status_code, 404)
        self.assertEqual(self.api.delete(detalhe).status_code, 404)
        resposta = self.api.post(comentarios, {'texto': 'Minha resposta', 'resposta_a': comentario_id}, format='json')
        self.assertEqual(resposta.status_code, 201)

        self.api.force_authenticate(self.tutor)
        self.assertEqual(self.api.delete(detalhe).status_code, 204)
        removido, preservado = self.api.get(comentarios).data
        self.assertEqual(removido['texto'], '')
        self.assertFalse(removido['pode_gerenciar'])
        self.assertEqual(preservado['texto'], 'Minha resposta')
        self.assertEqual(self.api.post(comentarios, {
            'texto': 'Nova resposta', 'resposta_a': comentario_id,
        }, format='json').status_code, 400)

    def test_compartilhamento_e_comentario_notificam_apenas_destinatarios(self):
        anotacao = Anotacao.objects.create(autor=self.aluno, titulo='Assunto', conteudo={})
        compartilhar = reverse('acompanhamento-compartilhar-anotacao', args=[self.espaco.pk, anotacao.pk])
        comentarios = reverse('acompanhamento-comentarios', args=[self.espaco.pk, 'anotacao', anotacao.pk])
        avisos_url = reverse('notificacao-list')
        Participacao.objects.filter(espaco=self.espaco, tutor__usuario=self.segundo_tutor).update(ativo=False)

        self.api.force_authenticate(self.aluno)
        self.assertEqual(self.api.post(compartilhar).status_code, 200)
        self.assertEqual(self.api.post(compartilhar).status_code, 200)
        self.assertEqual(self.api.get(avisos_url).data, [])

        self.api.force_authenticate(self.segundo_tutor)
        self.assertEqual(self.api.get(avisos_url).data, [])

        self.api.force_authenticate(self.tutor)
        avisos = self.api.get(avisos_url).data
        self.assertEqual(len(avisos), 1)
        self.assertEqual(avisos[0]['destino'], 'acompanhamento')
        self.assertEqual(avisos[0]['recurso_id'], self.espaco.pk)
        self.assertEqual(self.api.post(comentarios, {'texto': 'Comentário privado'}, format='json').status_code, 201)
        self.assertEqual(len(self.api.get(avisos_url).data), 1)

        self.api.force_authenticate(self.aluno)
        avisos = self.api.get(avisos_url).data
        self.assertEqual(len(avisos), 1)
        self.assertIn('comentário', avisos[0]['texto'])
        self.assertNotIn('Comentário privado', avisos[0]['texto'])
        self.assertEqual(avisos[0]['recurso_id'], self.espaco.pk)
