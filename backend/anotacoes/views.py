from django.db import transaction
from rest_framework import viewsets

from auditoria.services import registrar_atividade
from .models import Anotacao
from .serializers import AnotacaoSerializer


class AnotacaoViewSet(viewsets.ModelViewSet):
    queryset = Anotacao.objects.all().order_by('-data_atualizacao')
    serializer_class = AnotacaoSerializer

    @transaction.atomic
    def perform_create(self, serializer):
        anotacao = serializer.save()
        registrar_atividade(self.request, 'criar', 'anotacao', anotacao.pk)

    @transaction.atomic
    def perform_update(self, serializer):
        anotacao = serializer.save()
        registrar_atividade(self.request, 'editar', 'anotacao', anotacao.pk)

    @transaction.atomic
    def perform_destroy(self, instance):
        identificador = instance.pk
        instance.delete()
        registrar_atividade(self.request, 'excluir', 'anotacao', identificador)
