from django.contrib import admin

from .models import RegistroAtividade
from .services import ocultar_emails


@admin.register(RegistroAtividade)
class RegistroAtividadeAdmin(admin.ModelAdmin):
    list_display = (
        'data_hora',
        'acao',
        'resultado',
        'recurso',
        'recurso_id',
        'responsavel',
        'endereco_ip',
    )
    list_filter = ('resultado', 'acao', 'recurso', 'data_hora')
    search_fields = ('recurso_id', 'usuario__username', 'endereco_ip')
    readonly_fields = (
        'acao',
        'resultado',
        'recurso',
        'recurso_id',
        'responsavel',
        'data_hora',
        'endereco_ip',
        'user_agent',
        'descricao_oculta',
    )
    ordering = ('-data_hora', '-id')

    @admin.display(description='Responsável')
    def responsavel(self, obj):
        return ocultar_emails(obj.usuario.username) if obj.usuario else 'Sistema / não autenticado'

    @admin.display(description='Descrição')
    def descricao_oculta(self, obj):
        return ocultar_emails(obj.descricao)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
