from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from .services import excluir_mapa
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

    def destroy(self, request, *args, **kwargs):
        modo = request.query_params.get('modo')
        if modo not in ('excluir_tudo', 'manter_anotacoes'):
            raise ValidationError({'modo': 'Escolha excluir_tudo ou manter_anotacoes.'})
        pasta = excluir_mapa(self.get_object(), modo, request)
        return Response({'pasta_id': pasta.pk if pasta else None}, status=status.HTTP_200_OK)
