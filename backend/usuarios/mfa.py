"""TOTP, códigos de recuperação e desafios anteriores à liberação da sessão."""
import base64
import hashlib
import secrets
from datetime import timedelta
from io import BytesIO

import pyotp
import qrcode
from qrcode.image.svg import SvgPathImage
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from django.utils.crypto import salted_hmac

from auditoria.services import registrar_atividade
from .models import DesafioAutenticacao, EstadoAutenticacao, SegundoFator


def resumo(value):
    return hashlib.sha256(value.encode()).hexdigest()


def senha_assinada(user):
    return salted_hmac('locus.mfa.password', user.password, algorithm='sha256').hexdigest()


def ativo(user):
    return SegundoFator.objects.filter(usuario=user, ativo=True).exists()


def exigir_segundo_fator(user):
    return user.is_staff or ativo(user)


def revogar_sessoes(user):
    from django.db.models import F
    from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
    state, _ = EstadoAutenticacao.objects.get_or_create(usuario=user)
    EstadoAutenticacao.objects.filter(pk=state.pk).update(versao=F('versao') + 1)
    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)


def gerar_recuperacao(device):
    codes = [secrets.token_hex(16).upper() for _ in range(10)]
    device.recuperacao = [resumo(code) for code in codes]
    device.save(update_fields=['recuperacao'])
    return ['-'.join(code[i:i+8] for i in range(0, len(code), 8)) for code in codes]


def validar_codigo(device, code):
    """Chamado sob bloqueio do usuário/dispositivo, inclusive durante o consumo de um código."""
    if not isinstance(code, str) or len(code) > 80:
        return False
    code = code.strip().replace('-', '').replace(' ', '').upper()
    if len(code) == 6 and code.isascii() and code.isdigit():
        current = int(timezone.now().timestamp()) // 30
        totp = pyotp.TOTP(device.segredo)
        for counter in range(current - 1, current + 2):
            if counter > device.ultimo_contador and secrets.compare_digest(totp.at(counter * 30), code):
                device.ultimo_contador = counter
                device.save(update_fields=['ultimo_contador'])
                return True
    elif device.ativo and len(code) == 32:
        digest = resumo(code)
        for index, stored in enumerate(device.recuperacao):
            if secrets.compare_digest(stored, digest):
                device.recuperacao.pop(index)
                device.save(update_fields=['recuperacao'])
                return True
    return False


def preparar(user):
    device = SegundoFator.objects.filter(usuario=user).first()
    if device and device.ativo:
        raise ValueError('A verificação em duas etapas já está ativa.')
    device, _ = SegundoFator.objects.update_or_create(usuario=user, defaults={
        'segredo': pyotp.random_base32(), 'ativo': False, 'ultimo_contador': -1,
        'recuperacao': [], 'criado_em': timezone.now(),
    })
    return device


def apresentacao(device):
    uri = pyotp.TOTP(device.segredo).provisioning_uri(name=device.usuario.email or device.usuario.username, issuer_name='Locus')
    buffer = BytesIO()
    qrcode.make(uri, image_factory=SvgPathImage).save(buffer)
    return {'secret': device.segredo, 'qr_code': 'data:image/svg+xml;base64,' + base64.b64encode(buffer.getvalue()).decode()}


def confirmar_ativacao(user, device, code, request):
    if device.ativo or device.criado_em < timezone.now() - timedelta(minutes=5) or not validar_codigo(device, code):
        return None
    device.ativo = True
    device.save(update_fields=['ativo'])
    codes = gerar_recuperacao(device)
    revogar_sessoes(user)
    registrar_atividade(request, 'mfa_ativado', 'conta', user.pk, usuario=user)
    return codes


@transaction.atomic
def criar_desafio(user, contexto):
    from .authentication import versao_sessao
    user = get_user_model().objects.select_for_update().get(pk=user.pk, is_active=True)
    DesafioAutenticacao.objects.filter(expira_em__lt=timezone.now()-timedelta(days=1)).delete()
    DesafioAutenticacao.objects.filter(usuario=user, contexto=contexto, usado=False).update(usado=True)
    if user.is_staff:
        SegundoFator.objects.filter(usuario=user, ativo=False).delete()
    value = secrets.token_urlsafe(32)
    DesafioAutenticacao.objects.create(usuario=user, resumo=resumo(value), contexto=contexto,
        versao=versao_sessao(user), senha_assinada=senha_assinada(user), expira_em=timezone.now()+timedelta(minutes=5))
    return value


def obter_desafio(value, contexto):
    """Use dentro de transaction.atomic; a ordem de bloqueios é sempre usuário → desafio."""
    from .authentication import versao_sessao
    if not isinstance(value, str) or len(value) > 128:
        return None, None
    challenge = DesafioAutenticacao.objects.filter(resumo=resumo(value), contexto=contexto).first()
    if not challenge:
        return None, None
    user = get_user_model().objects.select_for_update().filter(pk=challenge.usuario_id, is_active=True).first()
    if not user:
        return None, None
    challenge = DesafioAutenticacao.objects.select_for_update().filter(pk=challenge.pk).first()
    if challenge is None:
        return None, None
    if (challenge.usado or challenge.tentativas >= 5 or challenge.expira_em <= timezone.now()
            or challenge.versao != versao_sessao(user)
            or not secrets.compare_digest(challenge.senha_assinada, senha_assinada(user))
            or contexto == 'admin' and not user.is_staff):
        return None, None
    return user, challenge


def falhar_desafio(challenge, request):
    challenge.tentativas += 1
    challenge.save(update_fields=['tentativas'])
    registrar_atividade(request, 'mfa_falha', 'conta', challenge.usuario_id, resultado='falha')


def emitir_sessao(request, user, *, mfa=False, dados=None):
    from django.middleware.csrf import get_token, rotate_token
    from rest_framework.response import Response
    from rest_framework_simplejwt.tokens import RefreshToken
    from .authentication import versao_sessao
    from .cookies import definir_cookies
    refresh = RefreshToken.for_user(user)
    refresh['session_version'] = versao_sessao(user)
    refresh['mfa_verified'] = mfa
    rotate_token(request)
    response = Response({'detail': 'Autenticação realizada.', 'csrf_token': get_token(request), **(dados or {})})
    response['Cache-Control'] = 'no-store'
    return definir_cookies(response, refresh)
