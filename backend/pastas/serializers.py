from rest_framework import serializers
from .models import Pasta


class PastaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pasta
        fields = ['id', 'nome', 'pai', 'autor', 'data_criacao']
        read_only_fields = ['id', 'autor', 'data_criacao']

    def validate_pai(self, value):
        if value is None:
            return value
        user = self.context['request'].user
        seen = set()
        current = value
        while current:
            if current.autor_id != user.pk or current.deletado_em is not None:
                raise serializers.ValidationError('Escolha uma pasta ativa da sua conta.')
            if current.pk in seen or (self.instance and current.pk == self.instance.pk):
                raise serializers.ValidationError('Uma pasta não pode ficar dentro de si mesma ou de uma subpasta sua.')
            seen.add(current.pk)
            current = current.pai
        return value


class PastaConteudoMixin:
    def validate_pasta(self, value):
        if value and (value.autor_id != self.context['request'].user.pk or value.deletado_em is not None):
            raise serializers.ValidationError('Escolha uma pasta ativa da sua conta.')
        return value
