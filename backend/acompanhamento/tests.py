from dataclasses import dataclass

from django.test import TestCase
from django.contrib.auth import get_user_model
from mapas.models import MapaMental
from anotacoes.models import Anotacao
from acompanhamento.models import PerfilTutor, EspacoAcompanhamento, Participacao, Convite, AnotacaoCompartilhada, MapaCompartilhado
from acompanhamento.services import aceitar_convite, remover_tutor, compartilhar_anotacao, compartilhar_mapa, pode_visualizar_anotacao, pode_visualizar_mapa
from django.core.exceptions import ValidationError, PermissionDenied
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status

class AceitacaoConviteTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.proprietario = User.objects.create_user(username='Ana', password='senha123')
        self.tutor_usuario = User.objects.create_user(username='Bruno', password='senha123')
        self.tutor = PerfilTutor.objects.create(usuario=self.tutor_usuario, nome_apresentacao='Tutor Teste')
        self.espaco = EspacoAcompanhamento.objects.create(proprietario=self.proprietario, nome='Espaço Teste')
        self.convite = Convite.objects.create(espaco=self.espaco, tutor=self.tutor, solicitado_por=self.proprietario)

    def test_aceitar_convite_sucesso(self):
        aceitar_convite(self.convite, self.tutor_usuario)
        self.convite.refresh_from_db()
        participacao = Participacao.objects.get(espaco=self.espaco, tutor=self.tutor)
        
        self.assertEqual(self.convite.status, 'aceito')
        self.assertTrue(participacao.ativo)
        self.assertEqual(
            Participacao.objects.filter(espaco=self.espaco, tutor=self.tutor).count(),
            1
        )
        self.assertIsNotNone(self.convite.respondido_em)

    def test_aceitar_convite_invalido_status(self):
        self.convite.status = 'aceito'
        self.convite.save()
        
        with self.assertRaises(ValidationError):
            aceitar_convite(self.convite, self.tutor_usuario)

    def test_aceitar_convite_invalido_usuario(self):
        outro_usuario = get_user_model().objects.create_user(username='outro', password='senha123')
        
        with self.assertRaises(PermissionDenied):
            aceitar_convite(self.convite, outro_usuario)

        self.convite.refresh_from_db()
        self.assertEqual(self.convite.status, 'pendente')
        self.assertFalse(
            Participacao.objects.filter(espaco=self.espaco, tutor=self.tutor).exists()
        )

    def test_aceitar_convite_solicitado_pelo_tutor(self):
        self.convite.solicitado_por = self.tutor_usuario
        self.convite.save(update_fields=['solicitado_por'])

        aceitar_convite(self.convite, self.proprietario)

        self.convite.refresh_from_db()

        self.assertEqual(self.convite.status, 'aceito')
        self.assertTrue(
            Participacao.objects.filter(
                espaco=self.espaco,
                tutor=self.tutor,
                ativo=True
            ).exists()
        )

    def test_aceitar_convite_tutor_inativo(self):
        self.tutor.ativo = False
        self.tutor.save(update_fields=['ativo'])

        with self.assertRaises(ValidationError):
            aceitar_convite(self.convite, self.tutor_usuario)

        self.convite.refresh_from_db()
        self.assertEqual(self.convite.status, 'pendente')
        self.assertFalse(
            Participacao.objects.filter(
                espaco=self.espaco,
                tutor=self.tutor
            ).exists()
        )

    def test_impede_participacoes_ativas_duplicadas(self):
        Participacao.objects.create(
            espaco=self.espaco,
            tutor=self.tutor,
            ativo=True
        )

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Participacao.objects.create(
                    espaco=self.espaco,
                    tutor=self.tutor,
                    ativo=True
                )

        self.assertEqual(
            Participacao.objects.filter(
                espaco=self.espaco,
                tutor=self.tutor,
                ativo=True
            ).count(),
            1
        )

    def test_proprietario_remove_tutor(self):
        aceitar_convite(self.convite, self.tutor_usuario)

        remover_tutor(self.espaco, self.tutor, self.proprietario)

        participacao = Participacao.objects.get(
            espaco=self.espaco,
            tutor=self.tutor
        )

        self.assertFalse(participacao.ativo)
        self.assertIsNotNone(participacao.saiu_em)

    def test_usuario_externo_nao_remove_tutor(self):
        aceitar_convite(self.convite, self.tutor_usuario)

        outro_usuario = get_user_model().objects.create_user(
            username='externo',
            password='senha123'
        )

        with self.assertRaises(PermissionDenied):
            remover_tutor(self.espaco, self.tutor, outro_usuario)

        participacao = Participacao.objects.get(
            espaco=self.espaco,
            tutor=self.tutor
        )

        self.assertTrue(participacao.ativo)
        self.assertIsNone(participacao.saiu_em)

@dataclass(frozen=True)
class TipoMaterial:
    modelo: type
    vinculo: type
    compartilhar: object
    pode_visualizar: object
    campo_conteudo: str


MATERIAIS = {
    'anotacao': TipoMaterial(
        Anotacao, AnotacaoCompartilhada, compartilhar_anotacao, pode_visualizar_anotacao, 'conteudo',
    ),
    'mapa': TipoMaterial(
        MapaMental, MapaCompartilhado, compartilhar_mapa, pode_visualizar_mapa, 'dados',
    ),
}


class MateriaisTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        usuarios = get_user_model().objects
        cls.proprietaria = usuarios.create_user(username='proprietaria')
        cls.usuario_tutor = usuarios.create_user(username='tutor')
        cls.externo = usuarios.create_user(username='externo')
        cls.tutor = PerfilTutor.objects.create(usuario=cls.usuario_tutor, nome_apresentacao='Tutor')

    def criar_canal(self):
        return EspacoAcompanhamento.objects.create(proprietario=self.proprietaria, nome='Estudos')

    def casos_materiais(self):
        for nome, tipo in MATERIAIS.items():
            material = tipo.modelo.objects.create(autor=self.proprietaria, titulo='Material de estudo')
            yield nome, tipo, material, self.criar_canal()


class CompartilhamentoMateriaisTests(MateriaisTestCase):
    def test_proprietaria_compartilha_material(self):
        for nome, tipo, material, canal in self.casos_materiais():
            with self.subTest(material=nome):
                vinculo = tipo.compartilhar(canal, material, self.proprietaria)
                self.assertEqual(vinculo.espaco, canal)
                self.assertEqual(getattr(vinculo, nome), material)
                self.assertEqual(tipo.vinculo.objects.filter(espaco=canal, **{nome: material}).count(), 1)

    def test_usuario_externo_nao_compartilha_material(self):
        for nome, tipo, material, canal in self.casos_materiais():
            with self.subTest(material=nome):
                with self.assertRaises(PermissionDenied):
                    tipo.compartilhar(canal, material, self.externo)
                self.assertFalse(tipo.vinculo.objects.filter(espaco=canal, **{nome: material}).exists())

    def test_proprietaria_nao_compartilha_material_alheio(self):
        for nome, tipo, _, canal in self.casos_materiais():
            with self.subTest(material=nome):
                material = tipo.modelo.objects.create(autor=self.externo, titulo='Material alheio')
                with self.assertRaises(PermissionDenied):
                    tipo.compartilhar(canal, material, self.proprietaria)
                self.assertFalse(tipo.vinculo.objects.filter(espaco=canal, **{nome: material}).exists())

    def test_nao_compartilha_material_excluido(self):
        for nome, tipo, material, canal in self.casos_materiais():
            with self.subTest(material=nome):
                material.deletado_em = timezone.now()
                material.save(update_fields=['deletado_em'])
                with self.assertRaises(ValidationError):
                    tipo.compartilhar(canal, material, self.proprietaria)
                self.assertFalse(tipo.vinculo.objects.filter(espaco=canal, **{nome: material}).exists())

    def test_compartilhar_mesmo_material_nao_duplica(self):
        for nome, tipo, material, canal in self.casos_materiais():
            with self.subTest(material=nome):
                primeiro = tipo.compartilhar(canal, material, self.proprietaria)
                segundo = tipo.compartilhar(canal, material, self.proprietaria)
                self.assertEqual(primeiro.pk, segundo.pk)
                self.assertEqual(tipo.vinculo.objects.filter(espaco=canal, **{nome: material}).count(), 1)


class PermissaoLeituraMateriaisTests(MateriaisTestCase):
    def test_proprietaria_visualiza_proprio_material(self):
        for nome, tipo, material, _ in self.casos_materiais():
            with self.subTest(material=nome):
                self.assertTrue(tipo.pode_visualizar(material, self.proprietaria))

    def test_tutor_ativo_visualiza_material_compartilhado(self):
        for nome, tipo, material, canal in self.casos_materiais():
            with self.subTest(material=nome):
                Participacao.objects.create(espaco=canal, tutor=self.tutor, ativo=True)
                tipo.vinculo.objects.create(espaco=canal, **{nome: material})
                self.assertTrue(tipo.pode_visualizar(material, self.usuario_tutor))

    def test_tutor_com_convite_pendente_nao_visualiza_material(self):
        for nome, tipo, material, canal in self.casos_materiais():
            with self.subTest(material=nome):
                Convite.objects.create(
                    espaco=canal, tutor=self.tutor, solicitado_por=self.proprietaria, status='pendente',
                )
                tipo.vinculo.objects.create(espaco=canal, **{nome: material})
                self.assertFalse(tipo.pode_visualizar(material, self.usuario_tutor))
                self.assertFalse(Participacao.objects.filter(espaco=canal, tutor=self.tutor, ativo=True).exists())

    def test_tutor_removido_perde_acesso_ao_material(self):
        for nome, tipo, material, canal in self.casos_materiais():
            with self.subTest(material=nome):
                participacao = Participacao.objects.create(espaco=canal, tutor=self.tutor, ativo=True)
                tipo.vinculo.objects.create(espaco=canal, **{nome: material})
                self.assertTrue(tipo.pode_visualizar(material, self.usuario_tutor))

                remover_tutor(canal, self.tutor, self.proprietaria)

                participacao.refresh_from_db()
                self.assertFalse(participacao.ativo)
                self.assertIsNotNone(participacao.saiu_em)
                self.assertFalse(tipo.pode_visualizar(material, self.usuario_tutor))

    def test_usuario_externo_nao_visualiza_material_compartilhado(self):
        for nome, tipo, material, canal in self.casos_materiais():
            with self.subTest(material=nome):
                tipo.vinculo.objects.create(espaco=canal, **{nome: material})
                self.assertFalse(tipo.pode_visualizar(material, self.externo))

    def test_tutor_ativo_nao_visualiza_material_nao_compartilhado(self):
        for nome, tipo, material, canal in self.casos_materiais():
            with self.subTest(material=nome):
                Participacao.objects.create(espaco=canal, tutor=self.tutor, ativo=True)
                self.assertFalse(tipo.pode_visualizar(material, self.usuario_tutor))

    def test_proprietaria_nao_visualiza_material_excluido(self):
        for nome, tipo, material, _ in self.casos_materiais():
            with self.subTest(material=nome):
                material.deletado_em = timezone.now()
                material.save(update_fields=['deletado_em'])
                self.assertFalse(tipo.pode_visualizar(material, self.proprietaria))


class APILeituraMateriaisTests(MateriaisTestCase):
    def setUp(self):
        self.client = APIClient()

    def url_material(self, nome, material):
        return reverse(f'acompanhamento-{nome}-detalhe', kwargs={'pk': material.pk})

    def test_proprietaria_consulta_proprio_material(self):
        self.client.force_authenticate(self.proprietaria)
        for nome, _, material, _ in self.casos_materiais():
            with self.subTest(material=nome):
                resposta = self.client.get(self.url_material(nome, material))
                self.assertEqual(resposta.status_code, status.HTTP_200_OK)
                self.assertEqual(resposta.data['titulo'], material.titulo)

    def test_tutor_ativo_consulta_material_compartilhado(self):
        self.client.force_authenticate(self.usuario_tutor)
        for nome, tipo, material, canal in self.casos_materiais():
            with self.subTest(material=nome):
                Participacao.objects.create(espaco=canal, tutor=self.tutor, ativo=True)
                tipo.vinculo.objects.create(espaco=canal, **{nome: material})
                resposta = self.client.get(self.url_material(nome, material))
                self.assertEqual(resposta.status_code, status.HTTP_200_OK)
                self.assertEqual(resposta.data['titulo'], material.titulo)

    def test_usuario_externo_nao_consulta_material_compartilhado(self):
        self.client.force_authenticate(self.externo)
        for nome, tipo, material, canal in self.casos_materiais():
            with self.subTest(material=nome):
                tipo.vinculo.objects.create(espaco=canal, **{nome: material})
                resposta = self.client.get(self.url_material(nome, material))
                self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)

    def test_usuario_nao_autenticado_nao_consulta_material(self):
        for nome, _, material, _ in self.casos_materiais():
            with self.subTest(material=nome):
                resposta = self.client.get(self.url_material(nome, material))
                self.assertIn(resposta.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_api_compartilhada_nao_permite_edicao_ou_exclusao(self):
        self.client.force_authenticate(self.proprietaria)
        for nome, _, material, _ in self.casos_materiais():
            for metodo in ('put', 'patch', 'delete'):
                with self.subTest(material=nome, metodo=metodo):
                    resposta = getattr(self.client, metodo)(
                        self.url_material(nome, material), {'titulo': 'Alterado'}, format='json',
                    )
                    self.assertEqual(resposta.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
                    material.refresh_from_db()
                    self.assertEqual(material.titulo, 'Material de estudo')
                    self.assertIsNone(material.deletado_em)

    def test_api_retorna_apenas_campos_permitidos(self):
        self.client.force_authenticate(self.proprietaria)
        for nome, tipo, material, _ in self.casos_materiais():
            with self.subTest(material=nome):
                resposta = self.client.get(self.url_material(nome, material))
                self.assertEqual(resposta.status_code, status.HTTP_200_OK)
                campo = tipo.campo_conteudo
                self.assertEqual(set(resposta.data), {'id', 'titulo', campo})
                self.assertEqual(resposta.data[campo], getattr(material, campo))

    def test_tutor_removido_nao_consulta_material_pela_api(self):
        self.client.force_authenticate(self.usuario_tutor)
        for nome, tipo, material, canal in self.casos_materiais():
            with self.subTest(material=nome):
                participacao = Participacao.objects.create(espaco=canal, tutor=self.tutor, ativo=True)
                tipo.vinculo.objects.create(espaco=canal, **{nome: material})
                url = self.url_material(nome, material)
                self.assertEqual(self.client.get(url).status_code, status.HTTP_200_OK)

                remover_tutor(canal, self.tutor, self.proprietaria)

                participacao.refresh_from_db()
                self.assertFalse(participacao.ativo)
                self.assertIsNotNone(participacao.saiu_em)
                self.assertEqual(self.client.get(url).status_code, status.HTTP_403_FORBIDDEN)

    def test_api_nao_retorna_material_excluido(self):
        self.client.force_authenticate(self.proprietaria)
        for nome, _, material, _ in self.casos_materiais():
            with self.subTest(material=nome):
                material.deletado_em = timezone.now()
                material.save(update_fields=['deletado_em'])
                resposta = self.client.get(self.url_material(nome, material))
                self.assertEqual(resposta.status_code, status.HTTP_404_NOT_FOUND)

    def test_tutor_nao_edita_anotacao_pela_api_original(self):
        anotacao = Anotacao.objects.create(autor=self.proprietaria, titulo='Estudo de Matemática')
        canal = self.criar_canal()
        Participacao.objects.create(espaco=canal, tutor=self.tutor, ativo=True)
        AnotacaoCompartilhada.objects.create(espaco=canal, anotacao=anotacao)
        self.client.force_authenticate(self.usuario_tutor)
        url = reverse('anotacao-detail', kwargs={'pk': anotacao.pk})
        resposta = self.client.patch(url, {'titulo': 'Alteração indevida'}, format='json')
        self.assertEqual(resposta.status_code, status.HTTP_404_NOT_FOUND)
        anotacao.refresh_from_db()
        self.assertEqual(anotacao.titulo, 'Estudo de Matemática')
