from rest_framework import serializers

from .models import MapaMental


class MapaMentalSerializer(serializers.ModelSerializer):
    class Meta:
        model = MapaMental
        fields = '__all__'
