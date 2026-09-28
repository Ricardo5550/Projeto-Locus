from django.db import transaction
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from auditoria.services import registrar_atividade
from .models import MapaMental
from .serializers import MapaMentalSerializer


class MapaMentalViewSet(viewsets.ModelViewSet):
    serializer_class = MapaMentalSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return MapaMental.objects.filter(
            autor=self.request.user
        ).order_by('-data_atualizacao')

    @transaction.atomic
    def perform_create(self, serializer):
        mapa = serializer.save(autor=self.request.user)
        registrar_atividade(
            self.request,
            'criar',
            'mapa_mental',
            mapa.pk,
        )

    @transaction.atomic
    def perform_update(self, serializer):
        mapa = serializer.save()
        registrar_atividade(
            self.request,
            'editar',
            'mapa_mental',
            mapa.pk,
        )

    @transaction.atomic
    def perform_destroy(self, instance):
        identificador = instance.pk
        instance.delete()
        registrar_atividade(
            self.request,
            'excluir',
            'mapa_mental',
            identificador,
        )