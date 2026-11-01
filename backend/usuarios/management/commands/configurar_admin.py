from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from auditoria.services import registrar_atividade
from usuarios.mfa import revogar_sessoes


class Command(BaseCommand):
    help = 'Configura um usuário existente como suporte ou auditor, sem torná-lo superusuário.'

    def add_arguments(self, parser):
        parser.add_argument('usuario')
        parser.add_argument('--perfil', choices=['suporte', 'auditoria'], required=True)

    @transaction.atomic
    def handle(self, *args, **options):
        try:
            user = get_user_model().objects.select_for_update().get(username=options['usuario'], is_active=True)
        except get_user_model().DoesNotExist:
            raise CommandError('Crie primeiro a conta ou informe um usuário ativo existente.')
        if user.is_superuser:
            raise CommandError('Este comando configura contas de equipe, não altera superusuários.')
        profile = options['perfil']
        group, _ = Group.objects.get_or_create(name='Locus ' + profile)
        names = {('auditoria', 'view_registroatividade'), ('usuarios', 'view_aceitelegal')}
        if profile == 'suporte':
            names |= {('auth', 'view_user'), ('usuarios', 'suporte_contas')}
        permissions = []
        for app, code in names:
            try:
                permissions.append(Permission.objects.get(content_type__app_label=app, codename=code))
            except Permission.DoesNotExist:
                raise CommandError('Execute migrate antes de configurar a equipe.')
        group.permissions.set(permissions)
        # Perfil restrito: remover permissões prévias evita acumular privilégios.
        user.groups.clear()
        user.user_permissions.clear()
        user.groups.add(group)
        user.is_staff = True
        user.save(update_fields=['is_staff'])
        revogar_sessoes(user)
        registrar_atividade(None, 'equipe_configurada', 'conta', user.pk, descricao='Perfil atribuído no servidor: ' + profile)
        self.stdout.write(self.style.SUCCESS('Perfil configurado. O primeiro acesso ao Admin exigirá configurar TOTP.'))
