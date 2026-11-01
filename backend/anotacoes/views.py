from django.db import transaction
from django.contrib.auth import get_user_model
from mapas.titles import sincronizar_titulo_anotacao
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from auditoria.services import registrar_atividade
from .models import Anotacao
from .serializers import AnotacaoSerializer
from .services import excluir_anotacao


class AnotacaoViewSet(viewsets.ModelViewSet):
    serializer_class = AnotacaoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Anotacao.objects.filter(
            autor=self.request.user
        ).order_by('-data_atualizacao')

    @transaction.atomic
    def perform_create(self, serializer):
        anotacao = serializer.save(autor=self.request.user)
        registrar_atividade(self.request, 'criar', 'anotacao', anotacao.pk)

    @transaction.atomic
    def perform_update(self, serializer):
        get_user_model().objects.select_for_update().get(pk=self.request.user.pk)
        anotacao = serializer.save()
        sincronizar_titulo_anotacao(anotacao)
        registrar_atividade(self.request, 'editar', 'anotacao', anotacao.pk)

    @transaction.atomic
    def perform_destroy(self, instance):
        identificador = instance.pk
        excluir_anotacao(instance)
        registrar_atividade(self.request, 'excluir', 'anotacao', identificador)
