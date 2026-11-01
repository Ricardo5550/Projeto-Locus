from django import forms
from django.contrib import admin, messages
from django.contrib.auth import get_user_model
from django.db import transaction
from django.template.response import TemplateResponse
from allauth.account.models import EmailAddress
from dj_rest_auth.serializers import PasswordResetSerializer

from auditoria.services import registrar_atividade
from .mfa import ativo, revogar_sessoes


class MotivoForm(forms.Form):
    motivo = forms.CharField(label='Motivo do atendimento', min_length=5, max_length=300, widget=forms.Textarea)


class ContaAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'is_active', 'email_confirmado', 'segundo_fator', 'last_login')
    search_fields = ('username', 'email')
    list_filter = ('is_active',)
    readonly_fields = ('username', 'email', 'is_active', 'email_confirmado', 'segundo_fator', 'date_joined', 'last_login')
    fields = readonly_fields
    actions = ('reenviar_confirmacao', 'enviar_recuperacao', 'suspender', 'reativar', 'encerrar_sessoes')

    @admin.display(boolean=True, description='E-mail confirmado')
    def email_confirmado(self, obj):
        return EmailAddress.objects.filter(user=obj, email__iexact=obj.email, verified=True).exists()

    @admin.display(boolean=True, description='2FA ativo')
    def segundo_fator(self, obj):
        return ativo(obj)

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        if not request.user.is_superuser:
            queryset = queryset.filter(is_staff=False, is_superuser=False)
        return queryset

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_suporte_permission(self, request):
        return request.user.is_superuser or request.user.has_perm('usuarios.suporte_contas')

    def atendimento(self, request, queryset, action):
        if not self.has_suporte_permission(request):
            from django.core.exceptions import PermissionDenied
            raise PermissionDenied
        form = MotivoForm(request.POST if request.POST.get('confirmar_atendimento') else None)
        if not request.POST.get('confirmar_atendimento') or not form.is_valid():
            return TemplateResponse(request, 'admin/locus_atendimento.html', {
                **self.admin_site.each_context(request), 'title': 'Confirmar atendimento', 'form': form,
                'accounts': queryset, 'action_name': action, 'opts': self.model._meta,
            })
        completed = 0
        for selected in queryset:
            # Suporte não opera sobre staff e nenhuma conta opera sobre si mesma.
            if selected.pk == request.user.pk or not request.user.is_superuser and (selected.is_staff or selected.is_superuser):
                continue
            try:
                with transaction.atomic():
                    user = get_user_model().objects.select_for_update().get(pk=selected.pk)
                    if not request.user.is_superuser and (user.is_staff or user.is_superuser):
                        continue
                    if action == 'reenviar_confirmacao':
                        address = EmailAddress.objects.filter(user=user, email__iexact=user.email, verified=False).first()
                        if address is None or not user.is_active:
                            continue
                        address.send_confirmation(request, signup=False)
                    elif action == 'enviar_recuperacao':
                        if not user.is_active:
                            continue
                        data = PasswordResetSerializer(data={'email': user.email}, context={'request': request})
                        data.is_valid(raise_exception=True)
                        data.save()
                    elif action in ('suspender', 'reativar'):
                        # Contas anonimizadas por exclusão não são reativáveis pelo suporte.
                        if action == 'reativar' and not user.has_usable_password():
                            continue
                        user.is_active = action == 'reativar'
                        user.save(update_fields=['is_active'])
                        revogar_sessoes(user)
                    else:
                        revogar_sessoes(user)
                    registrar_atividade(request, 'suporte_' + action, 'conta', user.pk, descricao=form.cleaned_data['motivo'])
                    completed += 1
            except Exception:
                # Nenhuma senha, código ou token de e-mail entra no registro.
                registrar_atividade(request, 'suporte_' + action, 'conta', selected.pk, resultado='falha', descricao=form.cleaned_data['motivo'])
                self.message_user(request, f'Não foi possível concluir o atendimento da conta #{selected.pk}.', level=messages.ERROR)
        self.message_user(request, f'Atendimento concluído para {completed} conta(s).')

    @admin.action(description='Reenviar confirmação de e-mail', permissions=['suporte'])
    def reenviar_confirmacao(self, request, queryset):
        return self.atendimento(request, queryset, 'reenviar_confirmacao')

    @admin.action(description='Enviar recuperação de senha', permissions=['suporte'])
    def enviar_recuperacao(self, request, queryset):
        return self.atendimento(request, queryset, 'enviar_recuperacao')

    @admin.action(description='Suspender acesso', permissions=['suporte'])
    def suspender(self, request, queryset):
        return self.atendimento(request, queryset, 'suspender')

    @admin.action(description='Reativar conta suspensa', permissions=['suporte'])
    def reativar(self, request, queryset):
        return self.atendimento(request, queryset, 'reativar')

    @admin.action(description='Encerrar sessões da conta', permissions=['suporte'])
    def encerrar_sessoes(self, request, queryset):
        return self.atendimento(request, queryset, 'encerrar_sessoes')


User = get_user_model()
if admin.site.is_registered(User):
    admin.site.unregister(User)
admin.site.register(User, ContaAdmin)
