from django.db import transaction
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from auditoria.services import registrar_atividade
from .models import Pergunta, Tentativa
from .serializers import PerguntaSerializer, TentativaSerializer
from .services import excluir_pergunta


class PerguntaViewSet(viewsets.ModelViewSet):
    serializer_class = PerguntaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = (
            Pergunta.objects
            .filter(anotacao__autor=self.request.user, anotacao__deletado_em__isnull=True)
            .select_related('anotacao')
            .prefetch_related('tentativas')
            .order_by('-data_criacao')
        )
        anotacao_id = self.request.query_params.get('anotacao')
        if anotacao_id:
            queryset = queryset.filter(anotacao_id=anotacao_id)
        return queryset

    @transaction.atomic
    def perform_create(self, serializer):
        pergunta = serializer.save()
        registrar_atividade(self.request, 'criar', 'pergunta', pergunta.pk)

    @transaction.atomic
    def perform_update(self, serializer):
        pergunta = serializer.save()
        registrar_atividade(self.request, 'editar', 'pergunta', pergunta.pk)

    @transaction.atomic
    def perform_destroy(self, instance):
        identificador = instance.pk
        excluir_pergunta(instance)
        registrar_atividade(self.request, 'excluir', 'pergunta', identificador)


class TentativaViewSet(viewsets.ModelViewSet):
    serializer_class = TentativaSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        queryset = (
            Tentativa.objects
            .filter(
                pergunta__anotacao__autor=self.request.user,
                pergunta__deletado_em__isnull=True,
                pergunta__anotacao__deletado_em__isnull=True,
            )
            .select_related('pergunta', 'pergunta__anotacao')
        )
        pergunta_id = self.request.query_params.get('pergunta')
        if pergunta_id:
            queryset = queryset.filter(pergunta_id=pergunta_id)
        return queryset

    @transaction.atomic
    def perform_create(self, serializer):
        tentativa = serializer.save()
        registrar_atividade(self.request, 'responder', 'tentativa', tentativa.pk)
