from rest_framework import viewsets
from .models import Anotacao
from .serializers import AnotacaoSerializer

class AnotacaoViewSet(viewsets.ModelViewSet):
    queryset = Anotacao.objects.all().order_by('-data_atualizacao')
    serializer_class = AnotacaoSerializer
