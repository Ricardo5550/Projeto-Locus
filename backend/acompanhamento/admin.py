from django.contrib import admin

from .models import PerfilTutor


@admin.register(PerfilTutor)
class PerfilTutorAdmin(admin.ModelAdmin):
    list_display = ('nome_apresentacao', 'usuario', 'aprovado', 'criado_em')
    list_filter = ('aprovado',)
    search_fields = ('nome_apresentacao', 'usuario__username', 'usuario__email')
    readonly_fields = (
        'usuario',
        'nome_apresentacao',
        'descricao',
        'area',
        'formacoes',
        'visibilidade',
        'ativo',
        'criado_em',
    )

    def save_model(self, request, obj, form, change):
        obj.save(update_fields=['aprovado'])

    def has_add_permission(self, request):
        return False
