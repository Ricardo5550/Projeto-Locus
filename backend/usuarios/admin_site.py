from django.contrib.admin import AdminSite
from django.contrib.admin.forms import AdminAuthenticationForm
from django.contrib.auth import login
from django.db import transaction
from django.shortcuts import redirect
from django.template.response import TemplateResponse
from django.urls import reverse
from django.utils.decorators import method_decorator
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect

from auditoria.services import registrar_atividade


class LocusAdminSite(AdminSite):
    site_header = 'Administração do Locus'
    site_title = 'Locus Admin'
    index_title = 'Gerenciamento e auditoria'

    def has_permission(self, request):
        if not super().has_permission(request):
            return False
        from .authentication import versao_sessao
        from .mfa import ativo
        return (request.session.get('locus_admin_mfa_user') == request.user.pk
                and request.session.get('locus_admin_mfa_version') == versao_sessao(request.user)
                and ativo(request.user))

    @method_decorator(never_cache)
    @method_decorator(csrf_protect)
    def login(self, request, extra_context=None):
        from . import mfa
        from .models import SegundoFator
        from .authentication import versao_sessao

        destination = request.POST.get('next') or request.GET.get('next') or reverse('admin:index')
        if not url_has_allowed_host_and_scheme(destination, {request.get_host()}, require_https=request.is_secure()):
            destination = reverse('admin:index')
        if self.has_permission(request) and request.method == 'GET':
            return redirect(destination)
        request.current_app = self.name
        form = AdminAuthenticationForm(request, data=request.POST if request.method == 'POST' and 'username' in request.POST else None)
        context = {**self.each_context(request), 'title': 'Acesso administrativo', 'form': form, 'next': destination, 'phase': 'password'}
        if request.method == 'POST' and request.POST.get('cancel'):
            request.session.pop('locus_admin_challenge', None)
            return redirect(reverse('admin:login'))
        if request.method == 'POST' and 'username' in request.POST:
            if form.is_valid():
                user = form.get_user()
                request.session.cycle_key()
                request.session['locus_admin_challenge'] = mfa.criar_desafio(user, 'admin')
                registrar_atividade(request, 'admin_primeira_etapa', 'conta', user.pk, usuario=user)
            else:
                registrar_atividade(request, 'admin_login_falha', 'conta', resultado='falha')
        value = request.session.get('locus_admin_challenge')
        if value:
            with transaction.atomic():
                user, challenge = mfa.obter_desafio(value, 'admin')
                if challenge is None:
                    request.session.pop('locus_admin_challenge', None)
                    context['error'] = 'Desafio encerrado ou expirado. Informe suas credenciais novamente.'
                else:
                    device = SegundoFator.objects.select_for_update().filter(usuario=user).first()
                    setup = not device or not device.ativo
                    if setup and (device is None or request.method == 'POST' and 'username' in request.POST):
                        device = mfa.preparar(user)
                    context['phase'] = 'setup' if setup else 'code'
                    context['account'] = user.username
                    if setup:
                        context.update(mfa.apresentacao(device))
                    if request.method == 'POST' and 'code' in request.POST:
                        code = request.POST.get('code', '')
                        codes = mfa.confirmar_ativacao(user, device, code, request) if setup else None
                        accepted = codes is not None if setup else mfa.validar_codigo(device, code)
                        if accepted:
                            challenge.usado = True
                            challenge.save(update_fields=['usado'])
                            login(request, user, backend='django.contrib.auth.backends.ModelBackend')
                            request.session['locus_admin_mfa_user'] = user.pk
                            request.session['locus_admin_mfa_version'] = versao_sessao(user)
                            request.session.set_expiry(3600)
                            request.session.pop('locus_admin_challenge', None)
                            registrar_atividade(request, 'admin_login', 'conta', user.pk, usuario=user)
                            if codes:
                                context.update(phase='recovery', recovery_codes=codes)
                            else:
                                return redirect(destination)
                        else:
                            mfa.falhar_desafio(challenge, request)
                            context['error'] = 'Código inválido, já utilizado ou configuração expirada.'
        return TemplateResponse(request, 'admin/locus_login.html', context)
