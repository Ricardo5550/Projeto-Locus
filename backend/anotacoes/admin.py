from django.contrib import admin

from .models import Anotacao


@admin.register(Anotacao)
class AnotacaoAdmin(admin.ModelAdmin):
    list_display = ('id', 'titulo', 'autor', 'data_atualizacao')
    search_fields = ('titulo',)
