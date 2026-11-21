from django.core.exceptions import ValidationError
from django.core.validators import URLValidator
from django.db import migrations


def revisar_aprovacoes(apps, schema_editor):
    PerfilTutor = apps.get_model('acompanhamento', 'PerfilTutor')
    RegistroAtividade = apps.get_model('auditoria', 'RegistroAtividade')
    validar_url = URLValidator(schemes=['http', 'https'])
    alias = schema_editor.connection.alias
    for perfil in PerfilTutor.objects.using(alias).filter(aprovado=True).iterator():
        certificado_valido = False
        for formacao in perfil.formacoes if isinstance(perfil.formacoes, list) else []:
            if not isinstance(formacao, dict) or not str(formacao.get('titulo', '')).strip():
                continue
            try:
                validar_url(formacao.get('link_comprovante', ''))
            except ValidationError:
                continue
            certificado_valido = True
            break
        if not certificado_valido:
            PerfilTutor.objects.using(alias).filter(pk=perfil.pk).update(aprovado=False)
            RegistroAtividade.objects.using(alias).create(
                acao='tutor_reanalise_certificado', recurso='perfil_tutor', recurso_id=perfil.pk,
                descricao='Aprovação retirada na atualização: certificado não informado ou inválido.',
            )


class Migration(migrations.Migration):
    dependencies = [
        ('acompanhamento', '0003_initial_completar_vinculos_e_restricoes'),
        ('auditoria', '0002_initial_vincular_usuario_ao_registro'),
    ]
    operations = [migrations.RunPython(revisar_aprovacoes, migrations.RunPython.noop)]
