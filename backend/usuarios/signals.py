from django.contrib.auth.signals import user_logged_out
from django.dispatch import receiver
from auditoria.services import registrar_atividade


@receiver(user_logged_out, dispatch_uid='locus.admin.logout.audit')
def registrar_logout_admin(sender, request, user, **kwargs):
    if request and user and request.path.startswith('/admin/'):
        registrar_atividade(request, 'admin_logout', 'conta', user.pk, usuario=user)
