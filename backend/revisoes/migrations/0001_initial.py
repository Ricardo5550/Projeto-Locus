from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [('anotacoes', '0002_anotacao_json_autor_opcional')]

    operations = [
        migrations.CreateModel(
            name='Pergunta',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('enunciado', models.TextField()),
                ('resposta', models.TextField()),
                ('trecho_origem', models.TextField(blank=True)),
                ('data_criacao', models.DateTimeField(auto_now_add=True)),
                ('anotacao', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='perguntas', to='anotacoes.anotacao')),
            ],
        ),
        migrations.CreateModel(
            name='Tentativa',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('resposta_digitada', models.TextField(blank=True)),
                ('acertou', models.BooleanField()),
                ('data_criacao', models.DateTimeField(auto_now_add=True)),
                ('pergunta', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tentativas', to='revisoes.pergunta')),
            ],
            options={'ordering': ['-data_criacao']},
        ),
    ]
