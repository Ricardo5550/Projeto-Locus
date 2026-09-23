from django.db import transaction
from rest_framework import viewsets

from auditoria.services import registrar_atividade
from .models import MapaMental
from .serializers import MapaMentalSerializer


class MapaMentalViewSet(viewsets.ModelViewSet):
    queryset = MapaMental.objects.all().order_by('-data_atualizacao')
    serializer_class = MapaMentalSerializer

    @transaction.atomic
    def perform_create(self, serializer):
        mapa = serializer.save()
        registrar_atividade(self.request, 'criar', 'mapa_mental', mapa.pk)

    @transaction.atomic
    def perform_update(self, serializer):
        mapa = serializer.save()
        registrar_atividade(self.request, 'editar', 'mapa_mental', mapa.pk)

    @transaction.atomic
    def perform_destroy(self, instance):
        identificador = instance.pk
        instance.delete()
        registrar_atividade(self.request, 'excluir', 'mapa_mental', identificador)
