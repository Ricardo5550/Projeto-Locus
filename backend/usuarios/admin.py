from django.contrib import admin

from .models import AceiteLegal


@admin.register(AceiteLegal)
class AceiteLegalAdmin(admin.ModelAdmin):
    list_display = (
        'usuario',
        'tipo_documento',
        'tipo_manifestacao',
        'versao',
        'aceito_em',
        'endereco_ip',
    )
    list_filter = ('tipo_documento', 'tipo_manifestacao', 'versao', 'aceito_em')
    search_fields = ('usuario__username', 'usuario__email', 'endereco_ip')
    readonly_fields = (
        'usuario',
        'tipo_documento',
        'tipo_manifestacao',
        'versao',
        'hash_documento',
        'aceito_em',
        'endereco_ip',
        'user_agent',
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
