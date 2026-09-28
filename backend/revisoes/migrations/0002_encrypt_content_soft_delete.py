import core.fields
from django.db import migrations, models


def encrypt_existing(apps, schema_editor):
    Pergunta = apps.get_model('revisoes', 'Pergunta')
    Tentativa = apps.get_model('revisoes', 'Tentativa')

    for pergunta in Pergunta.objects.all().iterator():
        pergunta.save(update_fields=['enunciado', 'resposta', 'trecho_origem'])

    for tentativa in Tentativa.objects.all().iterator():
        tentativa.save(update_fields=['resposta_digitada'])


class Migration(migrations.Migration):
    dependencies = [
        ('revisoes', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='pergunta',
            name='deletado_em',
            field=models.DateTimeField(blank=True, editable=False, null=True),
        ),
        migrations.AddField(
            model_name='tentativa',
            name='deletado_em',
            field=models.DateTimeField(blank=True, editable=False, null=True),
        ),
        migrations.AlterField(
            model_name='pergunta',
            name='enunciado',
            field=core.fields.EncryptedTextField(),
        ),
        migrations.AlterField(
            model_name='pergunta',
            name='resposta',
            field=core.fields.EncryptedTextField(),
        ),
        migrations.AlterField(
            model_name='pergunta',
            name='trecho_origem',
            field=core.fields.EncryptedTextField(blank=True),
        ),
        migrations.AlterField(
            model_name='tentativa',
            name='resposta_digitada',
            field=core.fields.EncryptedTextField(blank=True),
        ),
        migrations.RunPython(encrypt_existing, migrations.RunPython.noop),
    ]
