"""Operações públicas explicitamente expostas, com limites próprios."""
from dj_rest_auth.registration import views as registration
from dj_rest_auth import views as auth
from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from auditoria.services import registrar_atividade
from .mfa import revogar_sessoes


class RegisterView(registration.RegisterView):
    throttle_scope = 'registration'


class VerifyEmailView(registration.VerifyEmailView):
    throttle_scope = 'email_verify'


class ResendEmailVerificationView(registration.ResendEmailVerificationView):
    throttle_scope = 'email_resend'


class PasswordResetView(auth.PasswordResetView):
    throttle_scope = 'password_reset'

    def post(self, request, *args, **kwargs):
        try:
            response = super().post(request, *args, **kwargs)
        except APIException:
            registrar_atividade(request, 'recuperacao_solicitacao_falha', 'conta', resultado='falha')
            raise
        except Exception:
            registrar_atividade(request, 'recuperacao_envio_falha', 'conta', resultado='falha', descricao='Serviço de e-mail indisponível.')
            return Response({'detail': 'Não foi possível enviar a recuperação. Tente novamente mais tarde.'}, status=503)
        registrar_atividade(request, 'recuperacao_solicitada', 'conta', descricao='Solicitação recebida; não revela se o endereço existe.')
        return response


class PasswordResetConfirmView(auth.PasswordResetConfirmView):
    throttle_scope = 'password_confirm'

    def post(self, request, *args, **kwargs):
        try:
            data = self.get_serializer(data=request.data)
            data.is_valid(raise_exception=True)
            with transaction.atomic():
                user = get_user_model().objects.select_for_update().get(pk=data.user.pk, is_active=True)
                # Valide novamente após o bloqueio: o mesmo link não pode ser
                # consumido simultaneamente por duas solicitações.
                data = self.get_serializer(data=request.data)
                data.is_valid(raise_exception=True)
                data.save()
                revogar_sessoes(user)
                registrar_atividade(request, 'recuperacao_concluida', 'conta', user.pk, usuario=user)
        except APIException:
            registrar_atividade(request, 'recuperacao_confirmacao_falha', 'conta', resultado='falha')
            raise
        except get_user_model().DoesNotExist:
            registrar_atividade(request, 'recuperacao_confirmacao_falha', 'conta', resultado='falha')
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'detail': 'Link inválido, expirado ou já utilizado.'})
        return Response({'detail': 'Senha redefinida. Entre novamente; seu segundo fator permanece ativo.'})


class PasswordChangeView(auth.PasswordChangeView):
    throttle_scope = 'password_change'

    def post(self, request, *args, **kwargs):
        try:
            with transaction.atomic():
                request.user = get_user_model().objects.select_for_update().get(pk=request.user.pk, is_active=True)
                response = super().post(request, *args, **kwargs)
                revogar_sessoes(request.user)
                registrar_atividade(request, 'senha_alterada', 'conta', request.user.pk)
                return response
        except APIException:
            registrar_atividade(request, 'senha_alteracao_falha', 'conta', request.user.pk, resultado='falha')
            raise
