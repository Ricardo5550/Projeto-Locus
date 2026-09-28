from django.contrib import admin

from .models import Anotacao


@admin.register(Anotacao)
class AnotacaoAdmin(admin.ModelAdmin):
    list_display = ('id', 'titulo', 'autor', 'data_atualizacao', 'deletado_em')
    list_filter = ('deletado_em',)
    search_fields = ('titulo', 'autor__username')
    readonly_fields = ('deletado_em',)

    def get_queryset(self, request):
        return Anotacao.all_objects.select_related('autor')
