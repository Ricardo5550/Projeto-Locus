from django.db import migrations
from django.db.models import F, Window
from django.db.models.functions import RowNumber


def limpar_devolutivas_antigas(apps, schema_editor):
    Sessao = apps.get_model('revisoes', 'SessaoRevisao')
    sessoes = Sessao.objects.using(schema_editor.connection.alias)
    antigas = (
        sessoes.filter(deletado_em__isnull=True)
        .annotate(
            posicao=Window(
                expression=RowNumber(),
                partition_by=[F('questionario_id')],
                order_by=[F('data_criacao').desc(), F('pk').desc()],
            )
        )
        .filter(posicao__gt=1)
        .values('pk')
    )
    sessoes.filter(pk__in=antigas).update(respostas=[])
    sessoes.filter(deletado_em__isnull=False).update(respostas=[])


class Migration(migrations.Migration):
    dependencies = [('revisoes', '0002_initial_completar_vinculos_e_restricoes')]

    operations = [
        migrations.RunPython(limpar_devolutivas_antigas, migrations.RunPython.noop)
    ]
