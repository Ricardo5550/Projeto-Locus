from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('auditoria', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='registroatividade',
            name='acao',
            field=models.CharField(
                choices=[
                    ('login', 'Login'),
                    ('logout', 'Logout'),
                    ('criar', 'Criação'),
                    ('editar', 'Edição'),
                    ('excluir', 'Exclusão'),
                    ('responder', 'Resposta'),
                ],
                max_length=10,
            ),
        ),
        migrations.AlterField(
            model_name='registroatividade',
            name='recurso',
            field=models.CharField(
                choices=[
                    ('conta', 'Conta'),
                    ('anotacao', 'Anotação'),
                    ('mapa_mental', 'Mapa mental'),
                    ('pergunta', 'Pergunta'),
                    ('tentativa', 'Tentativa'),
                ],
                max_length=20,
            ),
        ),
    ]
