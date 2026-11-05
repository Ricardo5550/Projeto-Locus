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
)
from acompanhamento.services import (
    pode_visualizar_anotacao, 
    pode_visualizar_mapa, 
    aceitar_convite, 
    criar_convite, 
    recusar_convite, 
    remover_tutor, 
    compartilhar_anotacao, 
    compartilhar_mapa,
)
from mapas.models import MapaMental
from anotacoes.models import Anotacao
from .serializers import AnotacaoCompartilhadaLeituraSerializer, MapaCompartilhadoLeituraSerializer

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
        espaco_id = request.data.get('espaco_id')
        tutor_id = request.data.get('tutor_id')

        if not espaco_id or not tutor_id:
            raise DRFValidationError("Informe o espaço e o tutor.")

        espaco = get_object_or_404(
            EspacoAcompanhamento,
            pk=espaco_id
        )

        tutor = get_object_or_404(
            PerfilTutor,
            pk=tutor_id
        )

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
        nome = request.data.get('nome')

        if not isinstance(nome, str) or not nome.strip():
            raise DRFValidationError("Informe um nome válido para o espaco.")

        nome = nome.strip()

        if len(nome) > 100:
            raise DRFValidationError("O nome deve ter no máximo 100 caracteres.")

        espaco = EspacoAcompanhamento.objects.create(
            proprietario=request.user,
            nome=nome
        )

        return Response(
            {
                'id': espaco.pk,
                'nome': espaco.nome
            },
            status=201
        )

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

        eh_proprietario = espaco.proprietario_id == request.user.pk

        eh_tutor = Participacao.objects.filter(
            espaco=espaco,
            tutor__usuario=request.user,
            ativo=True,
            saiu_em__isnull=True
        ).exists()

        if not (eh_proprietario or eh_tutor):
            raise PermissionDenied("Você não tem permissão para acessar este espaço.")

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