from django.contrib import admin

from .models import MapaMental


@admin.register(MapaMental)
class MapaMentalAdmin(admin.ModelAdmin):
    list_display = ('id', 'titulo', 'data_atualizacao')
    search_fields = ('titulo',)
