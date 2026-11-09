from collections.abc import Mapping

from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, ValidationError as DRFValidationError
from acompanhamento.models import (
    Convite,
    EspacoAcompanhamento,
    PerfilTutor,
    Participacao,
    AnotacaoCompartilhada,
    MapaCompartilhado,
    MensagemAcompanhamento,
)
from acompanhamento.services import (
    pode_visualizar_anotacao,
    avisar_no_canal,
    pode_visualizar_mapa,
    aceitar_convite,
    criar_convite,
    recusar_convite,
    remover_tutor,
    compartilhar_anotacao,
    compartilhar_mapa,
)
from mapas.models import MapaMental
from mapas.services import anotacoes_vinculadas, blocos
from anotacoes.models import Anotacao
from .serializers import (
    CriarConviteSerializer,
    AnotacaoCompartilhadaLeituraSerializer,
    MapaCompartilhadoLeituraSerializer,
    PerfilTutorSerializer,
    MensagemAcompanhamentoSerializer,
    PublicarMensagemSerializer,
    TextoMensagemSerializer,
)

# Create your views here.
class AnotacaoCompartilhadaDetalheView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        anotacao = get_object_or_404(
            Anotacao,
            pk=pk,
            deletado_em__isnull=True
        )

        if not pode_visualizar_anotacao(anotacao, request.user):
            raise PermissionDenied("Você não tem permissão para visualizar esta anotação.")

        serializer = AnotacaoCompartilhadaLeituraSerializer(
            anotacao,
            context={'request': request}
        )

        return Response(serializer.data)

class AnotacaoVinculadaAoMapaView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk, mapa_id, anotacao_id):
        canal = get_object_or_404(EspacoAcompanhamento, pk=pk)
        exigir_acesso_espaco(canal, request.user)
        compartilhamento = get_object_or_404(
            MapaCompartilhado.objects.select_related('mapa'),
            espaco=canal, mapa_id=mapa_id, mapa__autor_id=canal.proprietario_id,
            mapa__deletado_em__isnull=True,
        )
        dados = compartilhamento.mapa.dados
        ids = anotacoes_vinculadas(dados)
        if isinstance(dados, dict) and 'views' not in dados:
            ids.update(
                bloco['linkedAnnotationId'] for bloco in blocos(dados)
                if type(bloco.get('linkedAnnotationId')) is int
            )
        anotacao = get_object_or_404(
            Anotacao, pk=anotacao_id, pk__in=ids, autor_id=canal.proprietario_id,
            deletado_em__isnull=True,
        )
        return Response(AnotacaoCompartilhadaLeituraSerializer(anotacao).data)


class MapaCompartilhadoDetalheView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        mapa = get_object_or_404(
            MapaMental,
            pk=pk,
            deletado_em__isnull=True
        )

        if not pode_visualizar_mapa(mapa, request.user):
            raise PermissionDenied("Você não tem permissão para visualizar este mapa.")

        serializer = MapaCompartilhadoLeituraSerializer(
            mapa,
            context={'request': request}
        )

        return Response(serializer.data)

class AceitarConviteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        convite = get_object_or_404(
            Convite,
            pk=pk
        )

        try:
            aceitar_convite(convite, request.user)
        except DjangoValidationError as erro:
            raise DRFValidationError(erro.messages)

        return Response(
            {'status': 'aceito'},
            status=200
        )

class CriarConviteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CriarConviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dados = serializer.validated_data
        espaco = get_object_or_404(EspacoAcompanhamento, pk=dados['espaco_id'])
        if espaco.proprietario_id != request.user.pk:
            raise PermissionDenied("Somente o proprietário pode convidar um tutor.")
        if 'usuario_tutor' in dados:
            tutor = get_object_or_404(PerfilTutor, usuario__username=dados['usuario_tutor'],
                                      ativo=True, usuario__is_active=True)
        else:
            tutor = get_object_or_404(PerfilTutor, pk=dados['tutor_id'])

        try:
            convite = criar_convite(
                espaco,
                tutor,
                request.user
            )
        except DjangoValidationError as erro:
            raise DRFValidationError(erro.messages)

        return Response(
            {
                'id': convite.pk,
                'status': convite.status
            },
            status=201
        )

class ConvitesRecebidosView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        convites = Convite.objects.filter(
            tutor__usuario=request.user,
            tutor__ativo=True,
            espaco__proprietario__is_active=True,
            status='pendente'
        ).select_related(
            'espaco',
            'solicitado_por'
        ).order_by('-criado_em')

        dados = [
            {
                'id': convite.pk,
                'espaco_id': convite.espaco_id,
                'espaco_nome': convite.espaco.nome,
                'solicitado_por_id': convite.solicitado_por_id,
                'status': convite.status
            }
            for convite in convites
        ]

        return Response(dados)

class RecusarConviteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        convite = get_object_or_404(
            Convite,
            pk=pk
        )

        try:
            convite = recusar_convite(
                convite,
                request.user
            )
        except DjangoValidationError as erro:
            raise DRFValidationError(erro.messages)

        return Response(
            {
                'id': convite.pk,
                'status': convite.status
            },
            status=200
        )

class EspacosAcompanhamentoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        espacos = EspacoAcompanhamento.objects.filter(
            proprietario=request.user
        ).order_by('-criado_em')

        dados = [
            {
                'id': espaco.pk,
                'nome': espaco.nome
            }
            for espaco in espacos
        ]

        return Response(dados)

    def post(self, request):
        canal = EspacoAcompanhamento.objects.create(
            proprietario=request.user, nome=validar_nome_canal(request.data),
        )
        return Response({'id': canal.pk, 'nome': canal.nome}, status=201)


def validar_nome_canal(dados):
    nome = dados.get('nome') if isinstance(dados, Mapping) else None
    if not isinstance(nome, str) or not nome.strip():
        raise DRFValidationError("Informe um nome válido para o canal.")
    nome = nome.strip()
    if len(nome) > 100:
        raise DRFValidationError("O nome deve ter no máximo 100 caracteres.")
    return nome


class CanalAcompanhamentoDetalheView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def patch(self, request, pk):
        canal = get_object_or_404(
            EspacoAcompanhamento.objects.select_for_update(), pk=pk, proprietario=request.user,
        )
        canal.nome = validar_nome_canal(request.data)
        canal.save(update_fields=['nome'])
        return Response({'id': canal.pk, 'nome': canal.nome})

    @transaction.atomic
    def delete(self, request, pk):
        canal = get_object_or_404(
            EspacoAcompanhamento.objects.select_for_update(), pk=pk, proprietario=request.user,
        )
        canal.delete()
        return Response(status=204)


class TutoresEspacoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        espaco = get_object_or_404(
            EspacoAcompanhamento,
            pk=pk,
            proprietario=request.user
        )

        participacoes = Participacao.objects.filter(
            espaco=espaco,
            ativo=True,
            saiu_em__isnull=True
        ).select_related('tutor')

        dados = [
            {
                'participacao_id': participacao.pk,
                'tutor_id': participacao.tutor_id,
                'nome_apresentacao': participacao.tutor.nome_apresentacao
            }
            for participacao in participacoes
        ]

        return Response(dados)

class RemoverTutorView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk, tutor_id):
        espaco = get_object_or_404(
            EspacoAcompanhamento,
            pk=pk,
            proprietario=request.user
        )

        tutor = get_object_or_404(
            PerfilTutor,
            pk=tutor_id
        )

        try:
            remover_tutor(
                espaco,
                tutor,
                request.user
            )
        except DjangoValidationError as erro:
            raise DRFValidationError(erro.messages)

        return Response(status=204)

class CompartilharAnotacaoView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk, anotacao_id):
        espaco = get_object_or_404(
            EspacoAcompanhamento,
            pk=pk,
            proprietario=request.user
        )

        anotacao = get_object_or_404(
            Anotacao,
            pk=anotacao_id,
            autor=request.user,
            deletado_em__isnull=True
        )

        try:
            compartilhamento = compartilhar_anotacao(
                espaco,
                anotacao,
                request.user
            )
        except DjangoValidationError as erro:
            raise DRFValidationError(erro.messages)

        return Response(
            {
                'id': compartilhamento.pk,
                'espaco_id': espaco.pk,
                'anotacao_id': anotacao.pk
            },
            status=200
        )

class CompartilharMapaView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk, mapa_id):
        espaco = get_object_or_404(
            EspacoAcompanhamento,
            pk=pk,
            proprietario=request.user
        )

        mapa = get_object_or_404(
            MapaMental,
            pk=mapa_id,
            autor=request.user,
            deletado_em__isnull=True
        )

        try:
            compartilhamento = compartilhar_mapa(
                espaco,
                mapa,
                request.user
            )
        except DjangoValidationError as erro:
            raise DRFValidationError(erro.messages)

        return Response(
            {
                'id': compartilhamento.pk,
                'espaco_id': espaco.pk,
                'mapa_id': mapa.pk
            },
            status=200
        )

class EspacosTutorView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        participacoes = Participacao.objects.filter(
            tutor__usuario=request.user,
            tutor__ativo=True,
            espaco__proprietario__is_active=True,
            ativo=True,
            saiu_em__isnull=True
        ).select_related('espaco').order_by('-entrou_em')

        dados = [
            {
                'id': participacao.espaco.pk,
                'nome': participacao.espaco.nome,
                'proprietario_id': participacao.espaco.proprietario_id
            }
            for participacao in participacoes
        ]

        return Response(dados)

class MateriaisCompartilhadosEspacoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        espaco = get_object_or_404(
            EspacoAcompanhamento,
            pk=pk
        )

        exigir_acesso_espaco(espaco, request.user)

        anotacoes = AnotacaoCompartilhada.objects.filter(
            espaco=espaco,
            anotacao__deletado_em__isnull=True
        ).select_related('anotacao')

        mapas = MapaCompartilhado.objects.filter(
            espaco=espaco,
            mapa__deletado_em__isnull=True
        ).select_related('mapa')

        dados = {
            'anotacoes': [
                {
                    'id': item.anotacao_id,
                    'titulo': item.anotacao.titulo
                }
                for item in anotacoes
            ],
            'mapas': [
                {
                    'id': item.mapa_id,
                    'titulo': item.mapa.titulo
                }
                for item in mapas
            ]
        }

        return Response(dados)

class TutoresDisponiveisView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        busca = request.query_params.get('busca', '').strip()

        if len(busca) < 2:
            return Response([])

        tutores = PerfilTutor.objects.filter(
            ativo=True,
            visibilidade='publico',
            usuario__is_active=True,
        ).filter(
            Q(nome_apresentacao__icontains=busca[:100]) |
            Q(area__in=[area.value for area in PerfilTutor.Area if busca.casefold() in area.label.casefold()])
        ).exclude(
            usuario=request.user
        ).order_by(
            'nome_apresentacao',
            'pk'
        ).values(
            'id',
            'nome_apresentacao',
            'descricao',
            'area',
            'formacoes',
        )[:20]

        return Response(list(tutores))

class PerfilTutorView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        perfil = get_object_or_404(
            PerfilTutor,
            usuario=request.user
        )

        serializer = PerfilTutorSerializer(perfil)

        return Response(
            serializer.data,
            status=200
        )

    def post(self, request):
        if PerfilTutor.objects.filter(
            usuario=request.user
        ).exists():
            raise DRFValidationError({'detail': 'Você já possui um perfil de tutor.'})

        serializer = PerfilTutorSerializer(
            data=request.data
        )

        serializer.is_valid(raise_exception=True)

        perfil, criado = PerfilTutor.objects.get_or_create(
            usuario=request.user,
            defaults=serializer.validated_data,
        )
        if not criado:
            raise DRFValidationError({'detail': 'Você já possui um perfil de tutor.'})

        return Response(
            PerfilTutorSerializer(perfil).data,
            status=201
        )

    def patch(self, request):
        perfil = get_object_or_404(
            PerfilTutor,
            usuario=request.user
        )

        serializer = PerfilTutorSerializer(
            perfil,
            data=request.data,
            partial=True
        )

        serializer.is_valid(raise_exception=True)

        serializer.save()

        return Response(
            serializer.data,
            status=200
        )


def exigir_acesso_espaco(espaco, usuario):
    if usuario.is_active and espaco.proprietario.is_active and (
        espaco.proprietario_id == usuario.pk or Participacao.objects.filter(
            espaco=espaco, tutor__usuario=usuario, tutor__ativo=True,
            ativo=True, saiu_em__isnull=True,
        ).exists()
    ):
        return
    raise PermissionDenied("Você não tem permissão para acessar este canal.")


class MensagensAcompanhamentoView(APIView):
    permission_classes = [IsAuthenticated]

    def contexto(self, request, pk, tipo_material='', material_id=None, *, bloquear=False):
        espacos = EspacoAcompanhamento.objects.all()
        if bloquear:
            espacos = espacos.select_for_update()
        espaco = get_object_or_404(espacos, pk=pk)
        exigir_acesso_espaco(espaco, request.user)

        if tipo_material == MensagemAcompanhamento.Material.ANOTACAO:
            get_object_or_404(AnotacaoCompartilhada, espaco=espaco, anotacao_id=material_id,
                              anotacao__deletado_em__isnull=True)
        elif tipo_material == MensagemAcompanhamento.Material.MAPA:
            get_object_or_404(MapaCompartilhado, espaco=espaco, mapa_id=material_id,
                              mapa__deletado_em__isnull=True)
        elif tipo_material:
            raise DRFValidationError('Tipo de material inválido.')

        return espaco, MensagemAcompanhamento.objects.filter(
            espaco=espaco, tipo_material=tipo_material, material_id=material_id,
        )

    def get(self, request, pk, **material):
        _, mensagens = self.contexto(request, pk, **material)
        return Response(MensagemAcompanhamentoSerializer(
            mensagens.select_related('autor').order_by('id'), many=True, context={'request': request},
        ).data)

    @transaction.atomic
    def post(self, request, pk, tipo_material='', material_id=None):
        espaco, mensagens = self.contexto(request, pk, tipo_material, material_id, bloquear=True)
        serializer = PublicarMensagemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dados = serializer.validated_data
        resposta_a = None
        if 'resposta_a' in dados:
            resposta_a = get_object_or_404(mensagens, pk=dados['resposta_a'], resposta_a__isnull=True)
            if not resposta_a.texto:
                raise DRFValidationError('Este comentário foi excluído.')
        elif not tipo_material and espaco.proprietario_id != request.user.pk:
            raise PermissionDenied('Somente o estudante pode publicar uma dúvida.')
        mensagem = mensagens.create(
            espaco=espaco, autor=request.user, tipo_material=tipo_material, material_id=material_id,
            texto=dados['texto'], resposta_a=resposta_a,
        )
        if not tipo_material or request.user.pk != espaco.proprietario_id:
            if tipo_material:
                texto_aviso = 'O tutor deixou um comentário em um material do canal.'
            elif resposta_a:
                texto_aviso = 'Há uma nova resposta a uma dúvida no canal.'
            else:
                texto_aviso = 'O estudante publicou uma dúvida no canal.'
            avisar_no_canal(espaco, request.user, f'mensagem:{mensagem.pk}', texto_aviso, duvida=not tipo_material)
        return Response(MensagemAcompanhamentoSerializer(mensagem, context={'request': request}).data, status=201)


class ComentarioAcompanhamentoDetalheView(MensagensAcompanhamentoView):
    http_method_names = ['patch', 'delete', 'options']

    def comentario_do_autor(self, request, pk, tipo_material, material_id, mensagem_id):
        _, mensagens = self.contexto(request, pk, tipo_material, material_id, bloquear=True)
        comentario = get_object_or_404(mensagens, pk=mensagem_id, autor=request.user)
        if not comentario.texto:
            raise DRFValidationError('Este comentário foi excluído.')
        return comentario

    @transaction.atomic
    def patch(self, request, pk, tipo_material, material_id, mensagem_id):
        comentario = self.comentario_do_autor(request, pk, tipo_material, material_id, mensagem_id)
        serializer = TextoMensagemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comentario.texto = serializer.validated_data['texto']
        comentario.save(update_fields=['texto'])
        return Response(MensagemAcompanhamentoSerializer(comentario, context={'request': request}).data)

    @transaction.atomic
    def delete(self, request, pk, tipo_material, material_id, mensagem_id):
        comentario = self.comentario_do_autor(request, pk, tipo_material, material_id, mensagem_id)
        if comentario.mensagemacompanhamento_set.exists():
            comentario.texto = ''
            comentario.save(update_fields=['texto'])
        else:
            comentario.delete()
        return Response(status=204)
