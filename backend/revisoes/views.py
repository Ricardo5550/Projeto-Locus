from rest_framework import viewsets
from .models import Pergunta, Tentativa
from .serializers import PerguntaSerializer, TentativaSerializer


class PerguntaViewSet(viewsets.ModelViewSet):
    queryset = Pergunta.objects.select_related('anotacao').prefetch_related('tentativas').order_by('-data_criacao')
    serializer_class = PerguntaSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        anotacao_id = self.request.query_params.get('anotacao')
        if anotacao_id:
            return queryset.filter(anotacao_id=anotacao_id)
        return queryset


class TentativaViewSet(viewsets.ModelViewSet):
    queryset = Tentativa.objects.select_related('pergunta').all()
    serializer_class = TentativaSerializer
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        queryset = super().get_queryset()
        pergunta_id = self.request.query_params.get('pergunta')
        if pergunta_id:
            return queryset.filter(pergunta_id=pergunta_id)
        return queryset
