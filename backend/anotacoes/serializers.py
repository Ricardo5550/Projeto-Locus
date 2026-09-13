from rest_framework import serializers
from .models import Anotacao

class AnotacaoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Anotacao
        fields = '__all__'