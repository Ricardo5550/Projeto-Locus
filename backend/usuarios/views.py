from urllib.parse import urlencode

import requests
from allauth.account.models import EmailAddress
from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.db import transaction
from django.shortcuts import redirect, get_object_or_404
from django.views import View
from django.middleware.csrf import get_token, rotate_token
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.authentication import JWTAuthentication
from .authentication import exigir_csrf, versao_sessao
from .cookies import definir_cookies, limpar_cookies
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework.views import APIView
from rest_framework import serializers
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle, ScopedRateThrottle
from core.throttling import LoginPairThrottle
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from auditoria.services import registrar_atividade
from .services import anonimizar_e_desativar_conta


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = 'login'
    throttle_classes = [AnonRateThrottle, UserRateThrottle, ScopedRateThrottle, LoginPairThrottle]

    def post(self, request):
        exigir_csrf(request)
        class Credentials(serializers.Serializer):
            email = serializers.EmailField(max_length=254)
            password = serializers.CharField(max_length=1024, trim_whitespace=False)
            captcha_token = serializers.CharField(max_length=8192, required=False)

        credentials = Credentials(data=request.data)
        credentials.is_valid(raise_exception=True)
        email = credentials.validated_data['email']
        password = credentials.validated_data['password']
        captcha_token = credentials.validated_data.get('captcha_token')

        if not email or not password:
            return Response(
                {'error': 'Informe o e-mail e a senha.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not captcha_token:
            return Response(
                {'error': 'Confirme o reCAPTCHA antes de entrar.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not settings.RECAPTCHA_SECRET_KEY:
            return Response(
                {'error': 'O reCAPTCHA não está configurado no servidor.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        try:
            recaptcha_response = requests.post(
                'https://www.google.com/recaptcha/api/siteverify',
                data={
                    'secret': settings.RECAPTCHA_SECRET_KEY,
                    'response': captcha_token,
                },
                timeout=5,
            )
            recaptcha_response.raise_for_status()
            resultado_google = recaptcha_response.json()
        except (requests.RequestException, ValueError):
            return Response(
                {'error': 'Não foi possível validar o reCAPTCHA. Tente novamente.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        if not resultado_google.get('success'):
            registrar_atividade(request, 'login_captcha_falha', 'conta', resultado='falha')
            return Response(
                {'error': 'Falha na verificação do reCAPTCHA.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        email_record = (
            EmailAddress.objects
            .select_related('user')
            .filter(email__iexact=email)
            .order_by('-verified', '-primary', '-id')
            .first()
        )

        if email_record is None:
            registrar_atividade(request, 'login_falha', 'conta', resultado='falha', descricao='Credenciais inválidas.')
            return Response(
                {'error': 'E-mail ou senha inválidos.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        user_record = email_record.user
        user = authenticate(
            request,
            username=user_record.get_username(),
            password=password,
        )

        if user is None:
            registrar_atividade(request, 'login_falha', 'conta', user_record.pk, resultado='falha', descricao='Credenciais inválidas.')
            return Response(
                {'error': 'E-mail ou senha inválidos.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not email_record.verified:
            registrar_atividade(request, 'login_bloqueado', 'conta', user.pk, resultado='bloqueado', descricao='E-mail não confirmado.')
            return Response(
                {'error': 'Confirme seu e-mail antes de entrar.', 'code': 'email_not_verified'},
                status=status.HTTP_403_FORBIDDEN,
            )

        from . import mfa
        if mfa.exigir_segundo_fator(user):
            challenge = mfa.criar_desafio(user, 'api')
            registrar_atividade(request, 'login_primeira_etapa', 'conta', user.pk, usuario=user)
            response = Response({'mfa_required': True, 'setup_required': not mfa.ativo(user), 'challenge': challenge})
            response['Cache-Control'] = 'no-store'
            return limpar_cookies(response)
        registrar_atividade(request, 'login', 'conta', user.pk, usuario=user)
        return mfa.emitir_sessao(request, user)


class CsrfView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        response = Response({'csrf_token': get_token(request)})
        response['Cache-Control'] = 'no-store'
        return response


class CookieRefreshView(APIView):
    throttle_scope = 'refresh'
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        exigir_csrf(request)
        raw = request.COOKIES.get(settings.JWT_REFRESH_COOKIE)
        if not raw:
            return limpar_cookies(Response({'detail': 'Sessão ausente.'}, status=401))
        try:
            old = RefreshToken(raw)
            user = JWTAuthentication().get_user(old)
            from .mfa import exigir_segundo_fator
            if exigir_segundo_fator(user) and old.get('mfa_verified') is not True:
                raise TokenError('Segundo fator obrigatório.')
            if old.get('session_version') != versao_sessao(user):
                raise TokenError('Sessão encerrada.')
            serializer = TokenRefreshSerializer(data={'refresh': raw})
            serializer.is_valid(raise_exception=True)
            refreshed = RefreshToken(serializer.validated_data['refresh'])
        except (TokenError, AuthenticationFailed, ValidationError, get_user_model().DoesNotExist):
            return limpar_cookies(Response({'detail': 'Sessão expirada.'}, status=401))
        return definir_cookies(Response({'detail': 'Sessão renovada.'}), refreshed)


class LogoutView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        exigir_csrf(request)
        raw = request.COOKIES.get(settings.JWT_REFRESH_COOKIE)
        if raw:
            try:
                token = RefreshToken(raw)
                user = get_user_model().objects.filter(pk=token['user_id']).first()
                token.blacklist()
                if user:
                    registrar_atividade(request, 'logout', 'conta', user.pk, usuario=user)
            except TokenError:
                pass
        return limpar_cookies(Response(status=status.HTTP_204_NO_CONTENT))


class EmailConfirmationRedirectView(View):
    """Recebe o link do e-mail e encaminha a chave para o SPA."""

    def get(self, request, key):
        query = urlencode({'verify_email': key})
        return redirect(f'{settings.FRONTEND_URL}/?{query}')


class PasswordResetRedirectView(View):
    """Encaminha uid/token do reset para a tela React."""

    def get(self, request, uidb64, token):
        query = urlencode({'reset_uid': uidb64, 'reset_token': token})
        return redirect(f'{settings.FRONTEND_URL}/?{query}')


class AccountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import AlteracaoEmail
        from django.utils import timezone
        from datetime import timedelta
        pending = AlteracaoEmail.objects.filter(usuario=request.user, criado_em__gte=timezone.now()-timedelta(seconds=settings.EMAIL_CHANGE_MAX_AGE)).first()
        return Response({
            'pending_email': pending.email if pending else None,
            'is_staff': request.user.is_staff,
            'pk': request.user.pk,
            'username': request.user.username,
            'email': request.user.email,
        })

    def patch(self, request):
        class AccountInput(serializers.Serializer):
            username = serializers.CharField(max_length=150)

        data = AccountInput(data=request.data)
        data.is_valid(raise_exception=True)
        username = data.validated_data['username']

        if not username:
            return Response(
                {'username': ['Informe um nome de usuário.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(username) > 150:
            return Response(
                {'username': ['O nome de usuário deve ter no máximo 150 caracteres.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        User = get_user_model()
        if User.objects.filter(username__iexact=username).exclude(pk=request.user.pk).exists():
            return Response(
                {'username': ['Este nome de usuário já existe.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if request.user.username != username:
            request.user.username = username
            request.user.save(update_fields=['username'])
            registrar_atividade(request, 'editar', 'conta', request.user.pk)

        return Response({
            'pk': request.user.pk,
            'username': request.user.username,
            'email': request.user.email,
            'is_staff': request.user.is_staff,
        })

    @transaction.atomic
    def delete(self, request):
        user = get_object_or_404(get_user_model().objects.select_for_update(), pk=request.user.pk, is_active=True)
        class DeleteInput(serializers.Serializer):
            password = serializers.CharField(max_length=1024, trim_whitespace=False)

        data = DeleteInput(data=request.data)
        data.is_valid(raise_exception=True)
        password = data.validated_data['password']

        if not password or not user.check_password(password):
            return Response(
                {'password': ['Senha atual inválida.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        registrar_atividade(request, 'excluir', 'conta', user.pk)
        anonimizar_e_desativar_conta(user)
        return limpar_cookies(Response(status=status.HTTP_204_NO_CONTENT))
