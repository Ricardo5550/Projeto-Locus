import logging
from datetime import timedelta
from urllib.parse import urlencode
from uuid import uuid4

from allauth.account.models import EmailAddress
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import signing
from django.core.mail import send_mail
from django.db import IntegrityError, transaction
from django.db.models import F
from django.shortcuts import redirect
from django.utils import timezone
from django.views import View
from rest_framework import serializers
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from auditoria.services import registrar_atividade
from .authentication import exigir_csrf
from .cookies import limpar_cookies
from .models import AlteracaoEmail, EstadoAutenticacao

logger = logging.getLogger(__name__)
SALT = 'locus.alteracao-email.v1'


class EmailChangeThrottle(UserRateThrottle):
    scope = 'email_change'
    rate = '5/hour'


class SolicitarEmailSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(trim_whitespace=False, max_length=1024)


class EmailChangeView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [EmailChangeThrottle]

    def post(self, request):
        serializer = SolicitarEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].strip().lower()
        if not request.user.check_password(serializer.validated_data['password']):
            return Response({'password': ['Senha atual inválida.']}, status=400)
        if email.casefold() == request.user.email.casefold():
            return Response({'email': ['Informe um endereço diferente do atual.']}, status=400)
        try:
            with transaction.atomic():
                user = get_user_model().objects.select_for_update().get(pk=request.user.pk, is_active=True)
                if not user.check_password(serializer.validated_data['password']):
                    return Response({'password': ['Senha atual inválida.']}, status=400)
                AlteracaoEmail.objects.filter(criado_em__lt=timezone.now()-timedelta(seconds=settings.EMAIL_CHANGE_MAX_AGE)).delete()
                if (EmailAddress.objects.filter(email__iexact=email).exclude(user=user).exists()
                        or get_user_model().objects.filter(email__iexact=email).exclude(pk=user.pk).exists()
                        or AlteracaoEmail.objects.filter(email__iexact=email).exclude(usuario=user).exists()):
                    return Response({'email': ['Este endereço não está disponível.']}, status=400)
                pending, _ = AlteracaoEmail.objects.update_or_create(usuario=user, defaults={
                    'email': email, 'email_anterior': user.email, 'nonce': uuid4()})
                token = signing.dumps({'id': pending.pk, 'nonce': str(pending.nonce)}, salt=SALT)
                link = request.build_absolute_uri('/api/auth/account/email/link/') + '?' + urlencode({'token': token})
                send_mail('Confirme seu novo e-mail no Locus',
                    f'Você solicitou alterar o e-mail da sua conta para {email}.\n\n'
                    f'Confirme pelo link abaixo em até 24 horas:\n{link}\n\n'
                    'Seu e-mail atual permanece válido até a confirmação. Se não foi você, não confirme.',
                    settings.DEFAULT_FROM_EMAIL, [email], fail_silently=False)
                registrar_atividade(request, 'solicitar_alteracao_email', 'conta', user.pk)
        except IntegrityError:
            return Response({'email': ['Este endereço não está disponível.']}, status=400)
        except Exception:
            logger.exception('Falha ao enviar confirmação de alteração de e-mail.')
            return Response({'detail': 'Não foi possível enviar a confirmação. Seu e-mail atual foi mantido.'}, status=503)
        return Response({'detail': 'Confira o novo e-mail. O endereço atual será mantido até você confirmar.'})


class EmailChangeRedirectView(View):
    def get(self, request):
        return redirect(settings.FRONTEND_URL + '/?' + urlencode({'change_email': request.GET.get('token', '')}))


class ConfirmEmailChangeView(APIView):
    throttle_scope = 'email_confirm'
    permission_classes = [AllowAny]
    authentication_classes = []

    @transaction.atomic
    def post(self, request):
        exigir_csrf(request)
        token = request.data.get('token')
        if not isinstance(token, str) or len(token) > 2048:
            return Response({'detail': 'Link inválido.'}, status=400)
        try:
            payload = signing.loads(token, salt=SALT, max_age=settings.EMAIL_CHANGE_MAX_AGE)
            pending = AlteracaoEmail.objects.get(pk=payload['id'], nonce=payload['nonce'])
            user = get_user_model().objects.select_for_update().get(pk=pending.usuario_id, is_active=True)
            pending = AlteracaoEmail.objects.select_for_update().get(pk=payload['id'], nonce=payload['nonce'], usuario=user)
        except (signing.BadSignature, AlteracaoEmail.DoesNotExist, get_user_model().DoesNotExist, KeyError, ValueError, TypeError):
            return Response({'detail': 'O link é inválido, expirou ou já foi utilizado.'}, status=400)
        if user.email != pending.email_anterior:
            return Response({'detail': 'Esta solicitação foi substituída. Solicite uma nova alteração.'}, status=400)
        email = pending.email
        if (EmailAddress.objects.filter(email__iexact=email).exclude(user=user).exists()
                or get_user_model().objects.filter(email__iexact=email).exclude(pk=user.pk).exists()):
            return Response({'detail': 'O endereço não está mais disponível.'}, status=400)
        # Somente o novo endereço confirmado poderá ser utilizado no login.
        EmailAddress.objects.filter(user=user).delete()
        EmailAddress.objects.create(user=user, email=email, primary=True, verified=True)
        user.email = email
        user.save(update_fields=['email'])
        state, _ = EstadoAutenticacao.objects.get_or_create(usuario=user)
        EstadoAutenticacao.objects.filter(pk=state.pk).update(versao=F('versao')+1)
        for outstanding in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=outstanding)
        pending.delete()
        registrar_atividade(request, 'alterar_email', 'conta', user.pk, usuario=user)
        return limpar_cookies(Response({'detail': 'E-mail alterado. Entre novamente com o novo endereço.'}))
