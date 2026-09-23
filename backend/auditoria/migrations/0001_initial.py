from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='RegistroAtividade',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('acao', models.CharField(choices=[('criar', 'Criação'), ('editar', 'Edição'), ('excluir', 'Exclusão')], max_length=10)),
                ('recurso', models.CharField(choices=[('anotacao', 'Anotação'), ('mapa_mental', 'Mapa mental')], max_length=20)),
                ('recurso_id', models.PositiveBigIntegerField()),
                ('data_hora', models.DateTimeField(auto_now_add=True)),
                ('usuario', models.ForeignKey(blank=True, editable=False, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'registro de atividade',
                'verbose_name_plural': 'registros de atividade',
                'ordering': ('-data_hora', '-id'),
            },
        ),
    ]
