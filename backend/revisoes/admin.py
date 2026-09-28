from django.contrib import admin

from .models import Pergunta, Tentativa


@admin.register(Pergunta)
class PerguntaAdmin(admin.ModelAdmin):
    list_display = ('id', 'anotacao', 'data_criacao', 'deletado_em')
    list_filter = ('deletado_em', 'data_criacao')
    readonly_fields = ('deletado_em',)

    def get_queryset(self, request):
        return Pergunta.all_objects.select_related('anotacao')


@admin.register(Tentativa)
class TentativaAdmin(admin.ModelAdmin):
    list_display = ('id', 'pergunta', 'acertou', 'data_criacao', 'deletado_em')
    list_filter = ('acertou', 'deletado_em', 'data_criacao')
    readonly_fields = ('deletado_em',)

    def get_queryset(self, request):
        return Tentativa.all_objects.select_related('pergunta')
