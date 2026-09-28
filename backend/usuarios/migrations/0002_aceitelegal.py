from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('usuarios', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='AceiteLegal',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tipo_documento', models.CharField(choices=[('terms', 'Termos de Uso'), ('privacy', 'Política de Privacidade')], max_length=20)),
                ('tipo_manifestacao', models.CharField(choices=[('acceptance', 'Aceite'), ('acknowledgement', 'Ciência de leitura')], max_length=20)),
                ('versao', models.CharField(max_length=20)),
                ('hash_documento', models.CharField(max_length=64)),
                ('aceito_em', models.DateTimeField(auto_now_add=True)),
                ('endereco_ip', models.GenericIPAddressField(blank=True, null=True)),
                ('user_agent', models.CharField(blank=True, max_length=500)),
                ('usuario', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='aceites_legais', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-aceito_em'],
            },
        ),
        migrations.AddConstraint(
            model_name='aceitelegal',
            constraint=models.UniqueConstraint(fields=('usuario', 'tipo_documento', 'versao'), name='unique_user_legal_document_version'),
        ),
    ]
