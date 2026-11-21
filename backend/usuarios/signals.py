from allauth.account.signals import user_signed_up, email_confirmed, email_confirmation_sent
from django.contrib.auth.signals import user_logged_out
from django.dispatch import receiver
from auditoria.services import registrar_atividade


@receiver(user_logged_out, dispatch_uid='locus.admin.logout.audit')
def registrar_logout_admin(sender, request, user, **kwargs):
    if request and user and request.path.startswith('/admin/'):
        registrar_atividade(request, 'admin_logout', 'conta', user.pk, usuario=user)




@receiver(user_signed_up, dispatch_uid='locus.conta.criada.audit')
def registrar_cadastro(sender, request, user, **kwargs):
    registrar_atividade(request, 'cadastro', 'conta', user.pk, usuario=user)


@receiver(email_confirmed, dispatch_uid='locus.email.confirmado.audit')
def registrar_confirmacao(sender, request, email_address, **kwargs):
    registrar_atividade(
        request, 'email_confirmado', 'conta', email_address.user_id,
        usuario=email_address.user,
    )


@receiver(email_confirmation_sent, dispatch_uid='locus.email.confirmacao.audit')
def registrar_envio_confirmacao(sender, request, confirmation, **kwargs):
    registrar_atividade(
        request, 'email_confirmacao_solicitada', 'conta', confirmation.email_address.user_id,
        descricao='Confirmação encaminhada ao transporte de e-mail.',
    )
