from django.contrib import admin

from .models import RegistroAtividade


@admin.register(RegistroAtividade)
class RegistroAtividadeAdmin(admin.ModelAdmin):
    list_display = ('data_hora', 'acao', 'recurso', 'recurso_id', 'usuario')
    list_filter = ('acao', 'recurso', 'data_hora')
    search_fields = ('recurso_id', 'usuario__username')
    readonly_fields = ('acao', 'recurso', 'recurso_id', 'usuario', 'data_hora')
    ordering = ('-data_hora', '-id')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
