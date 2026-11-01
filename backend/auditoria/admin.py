from django.contrib import admin

from .models import RegistroAtividade


@admin.register(RegistroAtividade)
class RegistroAtividadeAdmin(admin.ModelAdmin):
    list_display = ('data_hora', 'acao', 'resultado', 'recurso', 'recurso_id', 'usuario', 'endereco_ip')
    list_filter = ('resultado', 'acao', 'recurso', 'data_hora')
    search_fields = ('recurso_id', 'usuario__username', 'endereco_ip')
    readonly_fields = ('acao', 'resultado', 'recurso', 'recurso_id', 'usuario', 'data_hora', 'endereco_ip', 'user_agent', 'descricao')
    ordering = ('-data_hora', '-id')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
