from django.contrib import admin

from .models import MapaMental


@admin.register(MapaMental)
class MapaMentalAdmin(admin.ModelAdmin):
    list_display = ('id', 'titulo', 'autor', 'data_atualizacao', 'deletado_em')
    list_filter = ('deletado_em',)
    search_fields = ('titulo', 'autor__username')
    readonly_fields = ('deletado_em',)

    def get_queryset(self, request):
        return MapaMental.all_objects.select_related('autor')
