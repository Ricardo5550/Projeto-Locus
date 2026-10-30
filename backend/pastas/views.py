from django.db import transaction
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from auditoria.services import registrar_atividade
from .models import Pasta
from .serializers import PastaSerializer


class PastaViewSet(viewsets.ModelViewSet):
    serializer_class = PastaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Pasta.objects.filter(autor=self.request.user).order_by('nome', 'id')

    @transaction.atomic
    def perform_create(self, serializer):
        pasta = serializer.save(autor=self.request.user)
        registrar_atividade(self.request, 'criar', 'pasta', pasta.pk)

    @transaction.atomic
    def perform_update(self, serializer):
        pasta = serializer.save()
        registrar_atividade(self.request, 'editar', 'pasta', pasta.pk)

    @transaction.atomic
    def perform_destroy(self, instance):
        if (Pasta.objects.filter(pai=instance).exists()
                or instance.anotacoes.filter(deletado_em__isnull=True).exists()
                or instance.mapas.filter(deletado_em__isnull=True).exists()):
            raise ValidationError({'detail': 'Mova ou exclua os conteúdos e subpastas antes de excluir esta pasta.'})
        instance.delete()
        registrar_atividade(self.request, 'excluir', 'pasta', instance.pk)
