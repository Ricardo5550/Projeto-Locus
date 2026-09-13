from rest_framework import viewsets

from .models import MapaMental
from .serializers import MapaMentalSerializer


class MapaMentalViewSet(viewsets.ModelViewSet):
    queryset = MapaMental.objects.all().order_by('-data_atualizacao')
    serializer_class = MapaMentalSerializer
