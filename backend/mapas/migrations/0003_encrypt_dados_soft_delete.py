import core.fields
from django.db import migrations, models


def encrypt_existing(apps, schema_editor):
    MapaMental = apps.get_model('mapas', 'MapaMental')
    for mapa in MapaMental.objects.all().iterator():
        mapa.save(update_fields=['dados'])


class Migration(migrations.Migration):
    dependencies = [
        ('mapas', '0002_mapamental_autor'),
    ]

    operations = [
        migrations.AddField(
            model_name='mapamental',
            name='deletado_em',
            field=models.DateTimeField(blank=True, editable=False, null=True),
        ),
        migrations.AlterField(
            model_name='mapamental',
            name='dados',
            field=core.fields.EncryptedJSONField(default=dict),
        ),
        migrations.RunPython(encrypt_existing, migrations.RunPython.noop),
    ]
