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

# Create your tests here.
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

class CompartilhamentoAnotacaoTests(TestCase):
    def setUp(self):
        User = get_user_model()

        self.ana = User.objects.create_user(
            username='ana_compartilha',
            password='senha123'
        )

        self.espaco = EspacoAcompanhamento.objects.create(
            proprietario=self.ana,
            nome='Estudos de Matemática'
        )

        self.anotacao = Anotacao.objects.create(
            autor=self.ana,
            titulo='Equações do Segundo Grau'
        )

    def test_proprietaria_compartilha_anotacao(self):
        compartilhamento = compartilhar_anotacao(
            self.espaco,
            self.anotacao,
            self.ana
        )

        self.assertEqual(compartilhamento.espaco, self.espaco)
        self.assertEqual(compartilhamento.anotacao, self.anotacao)
        self.assertEqual(
            AnotacaoCompartilhada.objects.filter(
                espaco=self.espaco,
                anotacao=self.anotacao
            ).count(),
            1
        )

    def test_usuario_nao_proprietario_nao_compartilha(self):
        outro_usuario = get_user_model().objects.create_user(
            username='bruno_compartilha',
            password='senha123'
        )

        with self.assertRaises(PermissionDenied):
            compartilhar_anotacao(
                self.espaco,
                self.anotacao,
                outro_usuario
            )

        self.assertFalse(
            AnotacaoCompartilhada.objects.filter(
                espaco=self.espaco,
                anotacao=self.anotacao
            ).exists()
        )
        
    def test_proprietaria_nao_compartilha_anotacao_de_terceiro(self):
        bruno = get_user_model().objects.create_user(
            username='bruno_autor',
            password='senha123'
        )

        anotacao_bruno = Anotacao.objects.create(
            autor=bruno,
            titulo='Anotação do Bruno'
        )

        with self.assertRaises(PermissionDenied):
            compartilhar_anotacao(
                self.espaco,
                anotacao_bruno,
                self.ana
            )

        self.assertFalse(
            AnotacaoCompartilhada.objects.filter(
                espaco=self.espaco,
                anotacao=anotacao_bruno
            ).exists()
        )

    def test_nao_compartilha_anotacao_excluida(self):
        self.anotacao.deletado_em = timezone.now()
        self.anotacao.save(update_fields=['deletado_em'])

        with self.assertRaises(ValidationError):
            compartilhar_anotacao(
                self.espaco,
                self.anotacao,
                self.ana
            )

        self.assertFalse(
            AnotacaoCompartilhada.objects.filter(
                espaco=self.espaco,
                anotacao=self.anotacao
            ).exists()
        )

    def test_compartilhar_mesma_anotacao_nao_duplica(self):
        primeiro = compartilhar_anotacao(
            self.espaco,
            self.anotacao,
            self.ana
        )

        segundo = compartilhar_anotacao(
            self.espaco,
            self.anotacao,
            self.ana
        )

        self.assertEqual(primeiro.pk, segundo.pk)

        self.assertEqual(
            AnotacaoCompartilhada.objects.filter(
                espaco=self.espaco,
                anotacao=self.anotacao
            ).count(),
            1
        )

class CompartilhamentoMapaTests(TestCase):
    def setUp(self):
        User = get_user_model()

        self.ana = User.objects.create_user(
            username='ana_compartilha_mapa',
            password='senha123'
        )

        self.espaco = EspacoAcompanhamento.objects.create(
            proprietario=self.ana,
            nome='Estudos de Física'
        )

        self.mapa = MapaMental.objects.create(
            autor=self.ana,
            titulo='Leis de Newton'
        )

    def test_proprietaria_compartilha_mapa(self):
        compartilhamento = compartilhar_mapa(
            self.espaco,
            self.mapa,
            self.ana
        )

        self.assertEqual(compartilhamento.espaco, self.espaco)
        self.assertEqual(compartilhamento.mapa, self.mapa)
        self.assertEqual(
            MapaCompartilhado.objects.filter(
                espaco=self.espaco,
                mapa=self.mapa
            ).count(),
            1
        )

    def test_usuario_nao_proprietario_nao_compartilha_mapa(self):
        bruno = get_user_model().objects.create_user(
            username='bruno_compartilha_mapa',
            password='senha123'
        )

        with self.assertRaises(PermissionDenied):
            compartilhar_mapa(
                self.espaco,
                self.mapa,
                bruno
            )

        self.assertFalse(
            MapaCompartilhado.objects.filter(
                espaco=self.espaco,
                mapa=self.mapa
            ).exists()
        )

    def test_proprietaria_nao_compartilha_mapa_de_terceiro(self):
        bruno = get_user_model().objects.create_user(
            username='bruno_autor_mapa',
            password='senha123'
        )

        mapa_bruno = MapaMental.objects.create(
            autor=bruno,
            titulo='Mapa do Bruno'
        )

        with self.assertRaises(PermissionDenied):
            compartilhar_mapa(
                self.espaco,
                mapa_bruno,
                self.ana
            )

        self.assertFalse(
            MapaCompartilhado.objects.filter(
                espaco=self.espaco,
                mapa=mapa_bruno
            ).exists()
        )

    def test_nao_compartilha_mapa_excluido(self):
        self.mapa.deletado_em = timezone.now()
        self.mapa.save(update_fields=['deletado_em'])

        with self.assertRaises(ValidationError):
            compartilhar_mapa(
                self.espaco,
                self.mapa,
                self.ana
            )

        self.assertFalse(
            MapaCompartilhado.objects.filter(
                espaco=self.espaco,
                mapa=self.mapa
            ).exists()
        )

    def test_compartilhar_mesmo_mapa_nao_duplica(self):
        primeiro = compartilhar_mapa(
            self.espaco,
            self.mapa,
            self.ana
        )

        segundo = compartilhar_mapa(
            self.espaco,
            self.mapa,
            self.ana
        )

        self.assertEqual(primeiro.pk, segundo.pk)

        self.assertEqual(
            MapaCompartilhado.objects.filter(
                espaco=self.espaco,
                mapa=self.mapa
            ).count(),
            1
        )

class PermissaoLeituraAnotacaoTests(TestCase):
    def setUp(self):
        User = get_user_model()

        self.ana = User.objects.create_user(
            username='ana_leitura',
            password='senha123'
        )

        self.anotacao = Anotacao.objects.create(
            autor=self.ana,
            titulo='Estudo de Matemática'
        )

    def test_proprietaria_visualiza_propria_anotacao(self):
        resultado = pode_visualizar_anotacao(
            self.anotacao,
            self.ana
        )

        self.assertTrue(resultado)

    def test_tutor_ativo_visualiza_anotacao_compartilhada(self):
        bruno = get_user_model().objects.create_user(
            username='bruno_tutor_leitura',
            password='senha123'
        )

        tutor = PerfilTutor.objects.create(
            usuario=bruno,
            nome_apresentacao='Bruno'
        )

        espaco = EspacoAcompanhamento.objects.create(
            proprietario=self.ana,
            nome='Estudos de Matemática'
        )

        Participacao.objects.create(
            espaco=espaco,
            tutor=tutor,
            ativo=True
        )

        AnotacaoCompartilhada.objects.create(
            espaco=espaco,
            anotacao=self.anotacao
        )

        resultado = pode_visualizar_anotacao(
            self.anotacao,
            bruno
        )

        self.assertTrue(resultado)

    def test_tutor_com_convite_pendente_nao_visualiza_anotacao(self):
        bruno = get_user_model().objects.create_user(
            username='bruno_convite_pendente',
            password='senha123'
        )

        tutor = PerfilTutor.objects.create(
            usuario=bruno,
            nome_apresentacao='Bruno'
        )

        espaco = EspacoAcompanhamento.objects.create(
            proprietario=self.ana,
            nome='Estudos de Matemática'
        )

        Convite.objects.create(
            espaco=espaco,
            tutor=tutor,
            solicitado_por=self.ana,
            status='pendente'
        )

        AnotacaoCompartilhada.objects.create(
            espaco=espaco,
            anotacao=self.anotacao
        )

        resultado = pode_visualizar_anotacao(
            self.anotacao,
            bruno
        )

        self.assertFalse(resultado)

        self.assertFalse(
            Participacao.objects.filter(
                espaco=espaco,
                tutor=tutor,
                ativo=True
            ).exists()
        )

    def test_tutor_removido_nao_visualiza_anotacao(self):
        bruno = get_user_model().objects.create_user(
            username='bruno_tutor_removido',
            password='senha123'
        )

        tutor = PerfilTutor.objects.create(
            usuario=bruno,
            nome_apresentacao='Bruno'
        )

        espaco = EspacoAcompanhamento.objects.create(
            proprietario=self.ana,
            nome='Estudos de Matemática'
        )

        participacao = Participacao.objects.create(
            espaco=espaco,
            tutor=tutor,
            ativo=True
        )

        AnotacaoCompartilhada.objects.create(
            espaco=espaco,
            anotacao=self.anotacao
        )

        self.assertTrue(
            pode_visualizar_anotacao(self.anotacao, bruno)
        )

        remover_tutor(espaco, tutor, self.ana)

        participacao.refresh_from_db()

        self.assertFalse(participacao.ativo)
        self.assertIsNotNone(participacao.saiu_em)

        self.assertFalse(
            pode_visualizar_anotacao(self.anotacao, bruno)
        )

    def test_usuario_externo_nao_visualiza_anotacao(self):
        externo = get_user_model().objects.create_user(
            username='usuario_externo_leitura',
            password='senha123'
        )

        espaco = EspacoAcompanhamento.objects.create(
            proprietario=self.ana,
            nome='Estudos de Matemática'
        )

        AnotacaoCompartilhada.objects.create(
            espaco=espaco,
            anotacao=self.anotacao
        )

        resultado = pode_visualizar_anotacao(
            self.anotacao,
            externo
        )

        self.assertFalse(resultado)

    def test_tutor_ativo_nao_visualiza_anotacao_nao_compartilhada(self):
        bruno = get_user_model().objects.create_user(
            username='bruno_sem_compartilhamento',
            password='senha123'
        )

        tutor = PerfilTutor.objects.create(
            usuario=bruno,
            nome_apresentacao='Bruno'
        )

        espaco = EspacoAcompanhamento.objects.create(
            proprietario=self.ana,
            nome='Estudos de Matemática'
        )

        Participacao.objects.create(
            espaco=espaco,
            tutor=tutor,
            ativo=True
        )

        resultado = pode_visualizar_anotacao(
            self.anotacao,
            bruno
        )

        self.assertFalse(resultado)

    def test_proprietaria_nao_visualiza_anotacao_excluida(self):
        self.anotacao.deletado_em = timezone.now()
        self.anotacao.save(update_fields=['deletado_em'])

        resultado = pode_visualizar_anotacao(
            self.anotacao,
            self.ana
        )

        self.assertFalse(resultado)

class PermissaoLeituraMapaTests(TestCase):
    def setUp(self):
        User = get_user_model()

        self.ana = User.objects.create_user(
            username='ana_leitura_mapa',
            password='senha123'
        )

        self.mapa = MapaMental.objects.create(
            autor=self.ana,
            titulo='Leis de Newton'
        )

    def test_proprietaria_visualiza_proprio_mapa(self):
        resultado = pode_visualizar_mapa(
            self.mapa,
            self.ana
        )

        self.assertTrue(resultado)

    def test_tutor_ativo_visualiza_mapa_compartilhado(self):
        bruno = get_user_model().objects.create_user(
            username='bruno_tutor_mapa',
            password='senha123'
        )

        tutor = PerfilTutor.objects.create(
            usuario=bruno,
            nome_apresentacao='Bruno'
        )

        espaco = EspacoAcompanhamento.objects.create(
            proprietario=self.ana,
            nome='Estudos de Física'
        )

        Participacao.objects.create(
            espaco=espaco,
            tutor=tutor,
            ativo=True
        )

        MapaCompartilhado.objects.create(
            espaco=espaco,
            mapa=self.mapa
        )

        resultado = pode_visualizar_mapa(
            self.mapa,
            bruno
        )

        self.assertTrue(resultado)

    def test_tutor_com_convite_pendente_nao_visualiza_mapa(self):
        bruno = get_user_model().objects.create_user(
            username='bruno_convite_pendente_mapa',
            password='senha123'
        )

        tutor = PerfilTutor.objects.create(
            usuario=bruno,
            nome_apresentacao='Bruno'
        )

        espaco = EspacoAcompanhamento.objects.create(
            proprietario=self.ana,
            nome='Estudos de Física'
        )

        Convite.objects.create(
            espaco=espaco,
            tutor=tutor,
            solicitado_por=self.ana,
            status='pendente'
        )

        MapaCompartilhado.objects.create(
            espaco=espaco,
            mapa=self.mapa
        )

        resultado = pode_visualizar_mapa(
            self.mapa,
            bruno
        )

        self.assertFalse(resultado)

        self.assertFalse(
            Participacao.objects.filter(
                espaco=espaco,
                tutor=tutor,
                ativo=True
            ).exists()
        )

    def test_tutor_removido_nao_visualiza_mapa(self):
        bruno = get_user_model().objects.create_user(
            username='bruno_tutor_removido_mapa',
            password='senha123'
        )

        tutor = PerfilTutor.objects.create(
            usuario=bruno,
            nome_apresentacao='Bruno'
        )

        espaco = EspacoAcompanhamento.objects.create(
            proprietario=self.ana,
            nome='Estudos de Física'
        )

        participacao = Participacao.objects.create(
            espaco=espaco,
            tutor=tutor,
            ativo=True
        )

        MapaCompartilhado.objects.create(
            espaco=espaco,
            mapa=self.mapa
        )

        self.assertTrue(
            pode_visualizar_mapa(self.mapa, bruno)
        )

        remover_tutor(espaco, tutor, self.ana)

        participacao.refresh_from_db()

        self.assertFalse(participacao.ativo)
        self.assertIsNotNone(participacao.saiu_em)

        self.assertFalse(
            pode_visualizar_mapa(self.mapa, bruno)
        )
        
    def test_usuario_externo_nao_visualiza_mapa(self):
        externo = get_user_model().objects.create_user(
            username='usuario_externo_mapa',
            password='senha123'
        )

        espaco = EspacoAcompanhamento.objects.create(
            proprietario=self.ana,
            nome='Estudos de Física'
        )

        MapaCompartilhado.objects.create(
            espaco=espaco,
            mapa=self.mapa
        )

        resultado = pode_visualizar_mapa(
            self.mapa,
            externo
        )

        self.assertFalse(resultado)
        
    def test_tutor_ativo_nao_visualiza_mapa_nao_compartilhado(self):
        bruno = get_user_model().objects.create_user(
            username='bruno_mapa_nao_compartilhado',
            password='senha123'
        )

        tutor = PerfilTutor.objects.create(
            usuario=bruno,
            nome_apresentacao='Bruno'
        )

        espaco = EspacoAcompanhamento.objects.create(
            proprietario=self.ana,
            nome='Estudos de Física'
        )

        Participacao.objects.create(
            espaco=espaco,
            tutor=tutor,
            ativo=True
        )

        resultado = pode_visualizar_mapa(
            self.mapa,
            bruno
        )

        self.assertFalse(resultado)
        
    def test_proprietaria_nao_visualiza_mapa_excluido(self):
        self.mapa.deletado_em = timezone.now()
        self.mapa.save(update_fields=['deletado_em'])

        resultado = pode_visualizar_mapa(
            self.mapa,
            self.ana
        )

        self.assertFalse(resultado)

class APILeituraAnotacaoTests(TestCase):
    def setUp(self):
        User = get_user_model()

        self.ana = User.objects.create_user(
            username='ana_api_leitura',
            password='senha123'
        )

        self.anotacao = Anotacao.objects.create(
            autor=self.ana,
            titulo='Estudo de Matemática'
        )

        self.client = APIClient()

    def test_proprietaria_consulta_propria_anotacao(self):
        self.client.force_authenticate(user=self.ana)

        url = reverse(
            'acompanhamento-anotacao-detalhe',
            kwargs={'pk': self.anotacao.pk}
        )

        resposta = self.client.get(url)

        self.assertEqual(
            resposta.status_code,
            status.HTTP_200_OK
        )

        self.assertEqual(
            resposta.data['titulo'],
            self.anotacao.titulo
        )
    
    def test_tutor_ativo_consulta_anotacao_compartilhada(self):
        bruno = get_user_model().objects.create_user(
            username='bruno_api_leitura',
            password='senha123'
        )

        tutor = PerfilTutor.objects.create(
            usuario=bruno,
            nome_apresentacao='Bruno'
        )

        espaco = EspacoAcompanhamento.objects.create(
            proprietario=self.ana,
            nome='Estudos de Matemática'
        )

        Participacao.objects.create(
            espaco=espaco,
            tutor=tutor,
            ativo=True
        )

        AnotacaoCompartilhada.objects.create(
            espaco=espaco,
            anotacao=self.anotacao
        )

        self.client.force_authenticate(user=bruno)

        url = reverse(
            'acompanhamento-anotacao-detalhe',
            kwargs={'pk': self.anotacao.pk}
        )

        resposta = self.client.get(url)

        self.assertEqual(
            resposta.status_code,
            status.HTTP_200_OK
        )

        self.assertEqual(
            resposta.data['titulo'],
            self.anotacao.titulo
        )
    
    def test_usuario_externo_nao_consulta_anotacao(self):
        externo = get_user_model().objects.create_user(
            username='externo_api_leitura',
            password='senha123'
        )

        espaco = EspacoAcompanhamento.objects.create(
            proprietario=self.ana,
            nome='Estudos de Matemática'
        )

        AnotacaoCompartilhada.objects.create(
            espaco=espaco,
            anotacao=self.anotacao
        )

        self.client.force_authenticate(user=externo)

        url = reverse(
            'acompanhamento-anotacao-detalhe',
            kwargs={'pk': self.anotacao.pk}
        )

        resposta = self.client.get(url)

        self.assertEqual(
            resposta.status_code,
            status.HTTP_403_FORBIDDEN
        )
    
    def test_usuario_nao_autenticado_nao_consulta_anotacao(self):
        self.client.force_authenticate(user=None)

        url = reverse(
            'acompanhamento-anotacao-detalhe',
            kwargs={'pk': self.anotacao.pk}
        )

        resposta = self.client.get(url)

        self.assertIn(
            resposta.status_code,
            [
                status.HTTP_401_UNAUTHORIZED,
                status.HTTP_403_FORBIDDEN
            ]
        )
    
    def test_api_nao_permite_edicao_ou_exclusao(self):
        self.client.force_authenticate(user=self.ana)

        url = reverse(
            'acompanhamento-anotacao-detalhe',
            kwargs={'pk': self.anotacao.pk}
        )

        for metodo in ['put', 'patch', 'delete']:
            with self.subTest(metodo=metodo):
                resposta = getattr(self.client, metodo)(
                    url,
                    {'titulo': 'Título alterado'},
                    format='json'
                )

                self.assertEqual(
                    resposta.status_code,
                    status.HTTP_405_METHOD_NOT_ALLOWED
                )

        self.anotacao.refresh_from_db()

        self.assertEqual(
            self.anotacao.titulo,
            'Estudo de Matemática'
        )
    
    def test_api_retorna_apenas_campos_permitidos(self):
        self.client.force_authenticate(user=self.ana)

        url = reverse(
            'acompanhamento-anotacao-detalhe',
            kwargs={'pk': self.anotacao.pk}
        )

        resposta = self.client.get(url)

        self.assertEqual(
            resposta.status_code,
            status.HTTP_200_OK
        )

        self.assertEqual(
            set(resposta.data.keys()),
            {'id', 'titulo', 'conteudo'}
        )

        self.assertEqual(
            resposta.data['conteudo'],
            self.anotacao.conteudo
        )
    
    def test_tutor_removido_nao_consulta_anotacao_pela_api(self):
        bruno = get_user_model().objects.create_user(
            username='bruno_api_removido',
            password='senha123'
        )

        tutor = PerfilTutor.objects.create(
            usuario=bruno,
            nome_apresentacao='Bruno'
        )

        espaco = EspacoAcompanhamento.objects.create(
            proprietario=self.ana,
            nome='Estudos de Matemática'
        )

        Participacao.objects.create(
            espaco=espaco,
            tutor=tutor,
            ativo=True
        )

        AnotacaoCompartilhada.objects.create(
            espaco=espaco,
            anotacao=self.anotacao
        )

        self.client.force_authenticate(user=bruno)

        url = reverse(
            'acompanhamento-anotacao-detalhe',
            kwargs={'pk': self.anotacao.pk}
        )

        resposta_antes = self.client.get(url)

        self.assertEqual(
            resposta_antes.status_code,
            status.HTTP_200_OK
        )

        remover_tutor(espaco, tutor, self.ana)

        resposta_depois = self.client.get(url)

        self.assertEqual(
            resposta_depois.status_code,
            status.HTTP_403_FORBIDDEN
        )
    
    def test_api_nao_retorna_anotacao_excluida(self):
        self.anotacao.deletado_em = timezone.now()
        self.anotacao.save(update_fields=['deletado_em'])

        self.client.force_authenticate(user=self.ana)

        url = reverse(
            'acompanhamento-anotacao-detalhe',
            kwargs={'pk': self.anotacao.pk}
        )

        resposta = self.client.get(url)

        self.assertEqual(
            resposta.status_code,
            status.HTTP_404_NOT_FOUND
        )
        
    def test_tutor_nao_edita_anotacao_pela_api_original(self):
            bruno = get_user_model().objects.create_user(
                username='bruno_api_edicao',
                password='senha123'
            )
    
            tutor = PerfilTutor.objects.create(
                usuario=bruno,
                nome_apresentacao='Bruno'
            )
    
            espaco = EspacoAcompanhamento.objects.create(
                proprietario=self.ana,
                nome='Estudos de Matemática'
            )
    
            Participacao.objects.create(
                espaco=espaco,
                tutor=tutor,
                ativo=True
            )
    
            AnotacaoCompartilhada.objects.create(
                espaco=espaco,
                anotacao=self.anotacao
            )
    
            self.client.force_authenticate(user=bruno)
    
            url = reverse(
                'anotacao-detail',
                kwargs={'pk': self.anotacao.pk}
            )
    
            resposta = self.client.patch(
                url,
                {'titulo': 'Alteração indevida'},
                format='json'
            )
    
            self.assertEqual(
                resposta.status_code,
                status.HTTP_404_NOT_FOUND
            )
    
            self.anotacao.refresh_from_db()
    
            self.assertEqual(
                self.anotacao.titulo,
                'Estudo de Matemática'
            )

class APILeituraMapaTests(TestCase):
    def setUp(self):
        User = get_user_model()

        self.ana = User.objects.create_user(
            username='ana_api_mapa',
            password='senha123'
        )

        self.mapa = MapaMental.objects.create(
            autor=self.ana,
            titulo='Leis de Newton'
        )

        self.client = APIClient()

    def test_proprietaria_consulta_proprio_mapa(self):
        self.client.force_authenticate(user=self.ana)

        url = reverse(
            'acompanhamento-mapa-detalhe',
            kwargs={'pk': self.mapa.pk}
        )

        resposta = self.client.get(url)

        self.assertEqual(
            resposta.status_code,
            status.HTTP_200_OK
        )

        self.assertEqual(
            resposta.data['titulo'],
            self.mapa.titulo
        )
    
    def test_tutor_ativo_consulta_mapa_compartilhado(self):
        bruno = get_user_model().objects.create_user(
            username='bruno_api_mapa',
            password='senha123'
        )

        tutor = PerfilTutor.objects.create(
            usuario=bruno,
            nome_apresentacao='Bruno'
        )

        espaco = EspacoAcompanhamento.objects.create(
            proprietario=self.ana,
            nome='Estudos de Física'
        )

        Participacao.objects.create(
            espaco=espaco,
            tutor=tutor,
            ativo=True
        )

        MapaCompartilhado.objects.create(
            espaco=espaco,
            mapa=self.mapa
        )

        self.client.force_authenticate(user=bruno)

        url = reverse(
            'acompanhamento-mapa-detalhe',
            kwargs={'pk': self.mapa.pk}
        )

        resposta = self.client.get(url)

        self.assertEqual(
            resposta.status_code,
            status.HTTP_200_OK
        )

        self.assertEqual(
            resposta.data['titulo'],
            self.mapa.titulo
        )
    
    def test_usuario_externo_nao_consulta_mapa(self):
        externo = get_user_model().objects.create_user(
            username='externo_api_mapa',
            password='senha123'
        )

        espaco = EspacoAcompanhamento.objects.create(
            proprietario=self.ana,
            nome='Estudos de Física'
        )

        MapaCompartilhado.objects.create(
            espaco=espaco,
            mapa=self.mapa
        )

        self.client.force_authenticate(user=externo)

        url = reverse(
            'acompanhamento-mapa-detalhe',
            kwargs={'pk': self.mapa.pk}
        )

        resposta = self.client.get(url)

        self.assertEqual(
            resposta.status_code,
            status.HTTP_403_FORBIDDEN
        )
    
    def test_usuario_nao_autenticado_nao_consulta_mapa(self):
        self.client.force_authenticate(user=None)

        url = reverse(
            'acompanhamento-mapa-detalhe',
            kwargs={'pk': self.mapa.pk}
        )

        resposta = self.client.get(url)

        self.assertIn(
            resposta.status_code,
            [
                status.HTTP_401_UNAUTHORIZED,
                status.HTTP_403_FORBIDDEN
            ]
        )
    
    def test_api_nao_permite_edicao_ou_exclusao_mapa(self):
        self.client.force_authenticate(user=self.ana)

        url = reverse(
            'acompanhamento-mapa-detalhe',
            kwargs={'pk': self.mapa.pk}
        )

        for metodo in ['put', 'patch', 'delete']:
            with self.subTest(metodo=metodo):
                resposta = getattr(self.client, metodo)(
                    url,
                    {'titulo': 'Mapa alterado'},
                    format='json'
                )

                self.assertEqual(
                    resposta.status_code,
                    status.HTTP_405_METHOD_NOT_ALLOWED
                )

        self.mapa.refresh_from_db()

        self.assertEqual(
            self.mapa.titulo,
            'Leis de Newton'
        )

        self.assertIsNone(self.mapa.deletado_em)
    
    def test_api_retorna_apenas_campos_permitidos_mapa(self):
        self.client.force_authenticate(user=self.ana)

        url = reverse(
            'acompanhamento-mapa-detalhe',
            kwargs={'pk': self.mapa.pk}
        )

        resposta = self.client.get(url)

        self.assertEqual(
            resposta.status_code,
            status.HTTP_200_OK
        )

        self.assertEqual(
            set(resposta.data.keys()),
            {'id', 'titulo', 'dados'}
        )

        self.assertEqual(
            resposta.data['dados'],
            self.mapa.dados
        )
    
    def test_tutor_removido_nao_consulta_mapa_pela_api(self):
        bruno = get_user_model().objects.create_user(
            username='bruno_api_mapa_removido',
            password='senha123'
        )

        tutor = PerfilTutor.objects.create(
            usuario=bruno,
            nome_apresentacao='Bruno'
        )

        espaco = EspacoAcompanhamento.objects.create(
            proprietario=self.ana,
            nome='Estudos de Física'
        )

        participacao = Participacao.objects.create(
            espaco=espaco,
            tutor=tutor,
            ativo=True
        )

        MapaCompartilhado.objects.create(
            espaco=espaco,
            mapa=self.mapa
        )

        self.client.force_authenticate(user=bruno)

        url = reverse(
            'acompanhamento-mapa-detalhe',
            kwargs={'pk': self.mapa.pk}
        )

        resposta_antes = self.client.get(url)

        self.assertEqual(
            resposta_antes.status_code,
            status.HTTP_200_OK
        )

        remover_tutor(espaco, tutor, self.ana)

        participacao.refresh_from_db()

        self.assertFalse(participacao.ativo)
        self.assertIsNotNone(participacao.saiu_em)

        resposta_depois = self.client.get(url)

        self.assertEqual(
            resposta_depois.status_code,
            status.HTTP_403_FORBIDDEN
        )
    
    def test_api_nao_retorna_mapa_excluido(self):
        self.mapa.deletado_em = timezone.now()
        self.mapa.save(update_fields=['deletado_em'])

        self.client.force_authenticate(user=self.ana)

        url = reverse(
            'acompanhamento-mapa-detalhe',
            kwargs={'pk': self.mapa.pk}
        )

        resposta = self.client.get(url)

        self.assertEqual(
            resposta.status_code,
            status.HTTP_404_NOT_FOUND
        )