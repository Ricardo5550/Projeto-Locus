from django import forms
from django.contrib import admin

from usuarios.atendimento import decidir_aprovacao
from .serializers import PerfilTutorSerializer

from .models import PerfilTutor


class AprovacaoTutorForm(forms.ModelForm):
    class Meta:
        model = PerfilTutor
        fields = ['aprovado']

    def clean_aprovado(self):
        aprovado = self.cleaned_data['aprovado']
        if aprovado:
            validacao = PerfilTutorSerializer(
                self.instance, data={'formacoes': self.instance.formacoes}, partial=True,
            )
            if not validacao.is_valid():
                raise forms.ValidationError('Informe pelo menos um certificado válido antes de aprovar.')
            if not self.instance.ativo or not self.instance.usuario.is_active:
                raise forms.ValidationError('O perfil e a conta precisam estar ativos.')
        return aprovado


@admin.register(PerfilTutor)
class PerfilTutorAdmin(admin.ModelAdmin):
    form = AprovacaoTutorForm
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
        'criado_em', 'motivo_rejeicao', 'rejeitado_em',
    )

    def save_model(self, request, obj, form, change):
        decidir_aprovacao(request, obj.pk, obj.aprovado, 'Decisão registrada no painel interno do Django.')

    def has_add_permission(self, request):
        return False
