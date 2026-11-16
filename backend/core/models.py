from uuid import uuid4

from django.db import models
from django.utils import timezone


class SoftDeleteQuerySet(models.QuerySet):
    def delete(self):
        count = self.update(deletado_em=timezone.now(), **self.model.campos_ao_excluir)
        return count, {self.model._meta.label: count}

    def hard_delete(self):
        return super().delete()

    def ativos(self):
        return self.filter(deletado_em__isnull=True)

    def excluidos(self):
        return self.filter(deletado_em__isnull=False)


class ActiveManager(models.Manager.from_queryset(SoftDeleteQuerySet)):
    def get_queryset(self):
        return super().get_queryset().filter(deletado_em__isnull=True)


class SoftDeleteModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    deletado_em = models.DateTimeField(null=True, blank=True, editable=False)

    campos_ao_excluir = {}

    objects = ActiveManager()
    all_objects = SoftDeleteQuerySet.as_manager()

    class Meta:
        abstract = True

    def delete(self, using=None, keep_parents=False):
        if self.deletado_em is not None:
            return 0, {}

        self.deletado_em = timezone.now()
        for campo, valor in self.campos_ao_excluir.items():
            setattr(self, campo, valor)
        self.save(using=using, update_fields=['deletado_em', *self.campos_ao_excluir])
        return 1, {self._meta.label: 1}

    def restore(self):
        if self.deletado_em is not None:
            self.deletado_em = None
            self.save(update_fields=['deletado_em'])
