import core.fields
from django.db import migrations, models


def encrypt_existing(apps, schema_editor):
    Anotacao = apps.get_model('anotacoes', 'Anotacao')
    for anotacao in Anotacao.objects.all().iterator():
        anotacao.save(update_fields=['conteudo'])


class Migration(migrations.Migration):
    dependencies = [
        ('anotacoes', '0003_alter_anotacao_autor'),
    ]

    operations = [
        migrations.AddField(
            model_name='anotacao',
            name='deletado_em',
            field=models.DateTimeField(blank=True, editable=False, null=True),
        ),
        migrations.AlterField(
            model_name='anotacao',
            name='conteudo',
            field=core.fields.EncryptedJSONField(default=dict),
        ),
        migrations.RunPython(encrypt_existing, migrations.RunPython.noop),
    ]
