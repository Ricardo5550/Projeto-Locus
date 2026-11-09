from django.utils import timezone
from rest_framework import viewsets, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Notificacao


def atualizar_revisoes(usuario):
    from revisoes.models import Questionario
    pendentes = Questionario.objects.filter(autor=usuario, proxima_revisao__lte=timezone.localdate()).exclude(perguntas=None).distinct()
    chaves = []
    for q in pendentes:
        chave = f'revisao:{q.pk}:{q.versao}:{q.proxima_revisao}'
        chaves.append(chave)
        Notificacao.all_objects.get_or_create(destinatario=usuario, chave=chave, defaults={
            'tipo': 'revisao', 'texto': f'Revisão disponível: {q.titulo}', 'destino': 'questionnaire', 'recurso_id': q.pk})
    Notificacao.objects.filter(destinatario=usuario, tipo='revisao').exclude(chave__in=chaves).delete()


class NotificacaoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notificacao
        fields = ['id', 'tipo', 'texto', 'destino', 'recurso_id', 'lida', 'data_criacao']
        read_only_fields = fields


class NotificacaoViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificacaoSerializer

    def get_queryset(self):
        atualizar_revisoes(self.request.user)
        return Notificacao.objects.filter(destinatario=self.request.user)[:100] if self.action == 'list' else Notificacao.objects.filter(destinatario=self.request.user)

    @action(detail=True, methods=['post'])
    def ler(self, request, pk=None):
        aviso = self.get_object()
        aviso.lida = True
        aviso.save(update_fields=['lida'])
        return Response(self.get_serializer(aviso).data)
