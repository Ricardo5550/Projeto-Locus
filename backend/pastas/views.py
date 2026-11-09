from django.db import transaction
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from auditoria.services import registrar_atividade
from revisoes.models import Questionario
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
        from anotacoes.models import Anotacao
        from anotacoes.services import excluir_anotacao
        from mapas.models import MapaMental
        from mapas.services import excluir_mapa

        pastas = {instance.pk}
        pendentes = {instance.pk}
        while pendentes:
            pendentes = set(Pasta.objects.filter(
                autor=self.request.user, pai_id__in=pendentes
            ).values_list('pk', flat=True)) - pastas
            pastas.update(pendentes)
        if Questionario.objects.filter(autor=self.request.user, pasta_id__in=pastas).exists():
            raise ValidationError({
                'detail': 'Mova ou exclua os questionários vinculados à pasta ou às subpastas antes de excluir a pasta.'
            })

        notas = Anotacao.objects.filter(autor=self.request.user, pasta_id__in=pastas)
        mapas = MapaMental.objects.filter(autor=self.request.user, pasta_id__in=pastas)
        if len(pastas) > 1 or notas.exists() or mapas.exists():
            if self.request.query_params.get('confirmar_conteudo') != 'true':
                raise ValidationError({'detail': 'Confirme a exclusão da pasta e de todo o seu conteúdo.'})
        for mapa in mapas:
            excluir_mapa(mapa, 'excluir_tudo', self.request)
        for nota in notas:
            excluir_anotacao(nota)
            registrar_atividade(self.request, 'excluir', 'anotacao', nota.pk)
        for pasta in Pasta.objects.filter(pk__in=pastas, autor=self.request.user):
            pasta.delete()
            registrar_atividade(self.request, 'excluir', 'pasta', pasta.pk)
