from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from auditoria.services import registrar_atividade
from usuarios.models import SegundoFator, DesafioAutenticacao
from usuarios.mfa import revogar_sessoes


class Command(BaseCommand):
    help = 'Recuperação excepcional pelo operador do servidor após verificar a identidade do titular.'

    def add_arguments(self, parser):
        parser.add_argument('usuario')
        parser.add_argument('--motivo', required=True)
        parser.add_argument('--confirmar', required=True, help='Repita exatamente o nome do usuário.')

    @transaction.atomic
    def handle(self, *args, **options):
        if options['confirmar'] != options['usuario'] or not 5 <= len(options['motivo'].strip()) <= 300:
            raise CommandError('Confirme o usuário e informe um motivo entre 5 e 300 caracteres.')
        try:
            user = get_user_model().objects.select_for_update().get(username=options['usuario'], is_active=True)
        except get_user_model().DoesNotExist:
            raise CommandError('Usuário ativo não encontrado.')
        SegundoFator.objects.filter(usuario=user).delete()
        DesafioAutenticacao.objects.filter(usuario=user).delete()
        revogar_sessoes(user)
        registrar_atividade(None, 'mfa_redefinido_servidor', 'conta', user.pk, descricao=options['motivo'].strip())
        self.stdout.write(self.style.SUCCESS('Segundo fator redefinido e sessões revogadas. Staff deverá configurar TOTP novamente.'))
