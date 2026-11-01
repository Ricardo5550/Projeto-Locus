from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from auditoria.services import registrar_atividade
from .authentication import exigir_csrf
from .models import SegundoFator
from . import mfa


class CodigoInput(serializers.Serializer):
    challenge = serializers.CharField(max_length=128)
    code = serializers.CharField(max_length=80)


class MFAChallengeView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = 'mfa_verify'

    @transaction.atomic
    def post(self, request):
        exigir_csrf(request)
        data = CodigoInput(data=request.data)
        data.is_valid(raise_exception=True)
        user, challenge = mfa.obter_desafio(data.validated_data['challenge'], 'api')
        if not challenge:
            return Response({'detail': 'Desafio expirado ou encerrado. Entre novamente.'}, status=400)
        device = SegundoFator.objects.select_for_update().filter(usuario=user, ativo=True).first()
        if not device or not mfa.validar_codigo(device, data.validated_data['code']):
            mfa.falhar_desafio(challenge, request)
            return Response({'detail': 'Código inválido ou já utilizado.'}, status=400)
        challenge.usado = True
        challenge.save(update_fields=['usado'])
        registrar_atividade(request, 'mfa_sucesso', 'conta', user.pk, usuario=user)
        registrar_atividade(request, 'login', 'conta', user.pk, usuario=user)
        return mfa.emitir_sessao(request, user, mfa=True)


class MFAEnrollmentView(APIView):
    """Primeira configuração de contas staff, ainda sem uma sessão autenticada."""
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = 'mfa_setup'

    @transaction.atomic
    def post(self, request):
        exigir_csrf(request)
        class Input(serializers.Serializer):
            challenge = serializers.CharField(max_length=128)
            code = serializers.CharField(max_length=80, required=False)
        data = Input(data=request.data)
        data.is_valid(raise_exception=True)
        user, challenge = mfa.obter_desafio(data.validated_data['challenge'], 'api')
        if not challenge or not user.is_staff or mfa.ativo(user):
            return Response({'detail': 'Configuração indisponível. Entre novamente.'}, status=400)
        code = data.validated_data.get('code')
        device = SegundoFator.objects.select_for_update().filter(usuario=user).first()
        if code is None:
            if device is None:
                device = mfa.preparar(user)
            response = Response(mfa.apresentacao(device))
            response['Cache-Control'] = 'no-store'
            return response
        codes = mfa.confirmar_ativacao(user, device, code, request) if device else None
        if codes is None:
            mfa.falhar_desafio(challenge, request)
            return Response({'detail': 'Código inválido ou configuração expirada. Reinicie o login.'}, status=400)
        challenge.usado = True
        challenge.save(update_fields=['usado'])
        registrar_atividade(request, 'login', 'conta', user.pk, usuario=user)
        return mfa.emitir_sessao(request, user, mfa=True, dados={'recovery_codes': codes})


class MFAManagementView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = 'mfa_manage'

    def get(self, request):
        device = SegundoFator.objects.filter(usuario=request.user, ativo=True).first()
        response = Response({'enabled': bool(device), 'required': request.user.is_staff,
                             'recovery_remaining': len(device.recuperacao) if device else 0})
        response['Cache-Control'] = 'no-store'
        return response

    @transaction.atomic
    def post(self, request):
        class Input(serializers.Serializer):
            action = serializers.ChoiceField(choices=['setup', 'activate', 'regenerate', 'disable'])
            password = serializers.CharField(max_length=1024, trim_whitespace=False)
            code = serializers.CharField(max_length=80, required=False, default='', allow_blank=True)
        data = Input(data=request.data)
        data.is_valid(raise_exception=True)
        user = get_user_model().objects.select_for_update().get(pk=request.user.pk, is_active=True)
        if not user.check_password(data.validated_data['password']):
            registrar_atividade(request, 'mfa_gestao_falha', 'conta', user.pk, resultado='falha', descricao='Senha atual inválida.')
            return Response({'detail': 'Senha atual inválida.'}, status=400)
        action = data.validated_data['action']
        device = SegundoFator.objects.select_for_update().filter(usuario=user).first()
        if action == 'setup':
            if device and device.ativo:
                return Response({'detail': 'A verificação em duas etapas já está ativa.'}, status=400)
            response = Response(mfa.apresentacao(mfa.preparar(user)))
            response['Cache-Control'] = 'no-store'
            return response
        code = data.validated_data['code']
        if action == 'activate':
            codes = mfa.confirmar_ativacao(user, device, code, request) if device else None
            if codes is None:
                registrar_atividade(request, 'mfa_ativacao_falha', 'conta', user.pk, resultado='falha')
                return Response({'detail': 'Código inválido ou configuração expirada.'}, status=400)
            return mfa.emitir_sessao(request, user, mfa=True, dados={'recovery_codes': codes})
        if action == 'disable' and user.is_staff:
            return Response({'detail': 'Contas administrativas devem manter a verificação em duas etapas.'}, status=403)
        if not device or not device.ativo or not mfa.validar_codigo(device, code):
            registrar_atividade(request, 'mfa_gestao_falha', 'conta', user.pk, resultado='falha', descricao='Segundo fator inválido.')
            return Response({'detail': 'Código inválido ou já utilizado.'}, status=400)
        if action == 'regenerate':
            codes = mfa.gerar_recuperacao(device)
            mfa.revogar_sessoes(user)
            registrar_atividade(request, 'mfa_codigos_regenerados', 'conta', user.pk, usuario=user)
            return mfa.emitir_sessao(request, user, mfa=True, dados={'recovery_codes': codes})
        device.delete()
        mfa.revogar_sessoes(user)
        registrar_atividade(request, 'mfa_desativado', 'conta', user.pk, usuario=user)
        return mfa.emitir_sessao(request, user)
