from django.db import models
from django.contrib.auth.models import User

# Create your models here.
## Registro de Estudantes.
class Estudante(models.Model):
    usuario = models.OneToOneField(
        User, 
        on_delete=models.CASCADE
    )

    def __str__(self):
        return self.usuario.username
