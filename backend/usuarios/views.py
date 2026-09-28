from urllib.parse import urlencode

import requests
from allauth.account.models import EmailAddress
from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.db import transaction
from django.shortcuts import redirect
from django.views import View
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from auditoria.services import registrar_atividade
from .services import anonimizar_e_desativar_conta


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get('email') or '').strip()
        password = request.data.get('password') or ''
        captcha_token = request.data.get('captcha_token')

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
            return Response(
                {'error': 'E-mail ou senha inválidos.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not email_record.verified:
            return Response(
                {'error': 'Confirme seu e-mail antes de entrar.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        refresh = RefreshToken.for_user(user)
        registrar_atividade(request, 'login', 'conta', user.pk, usuario=user)

        return Response(
            {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
            status=status.HTTP_200_OK,
        )


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')

        if refresh_token:
            try:
                RefreshToken(refresh_token).blacklist()
            except TokenError:
                pass

        registrar_atividade(request, 'logout', 'conta', request.user.pk)
        return Response(status=status.HTTP_204_NO_CONTENT)


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
        return Response({
            'pk': request.user.pk,
            'username': request.user.username,
            'email': request.user.email,
        })

    def patch(self, request):
        username = (request.data.get('username') or '').strip()

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
        })

    @transaction.atomic
    def delete(self, request):
        password = request.data.get('password') or ''

        if not password or not request.user.check_password(password):
            return Response(
                {'password': ['Senha atual inválida.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user
        registrar_atividade(request, 'excluir', 'conta', user.pk)
        anonimizar_e_desativar_conta(user)
        return Response(status=status.HTTP_204_NO_CONTENT)
