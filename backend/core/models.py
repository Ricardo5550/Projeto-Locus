from django.db import models
from django.utils import timezone


class SoftDeleteQuerySet(models.QuerySet):
    def delete(self):
        count = self.update(deletado_em=timezone.now())
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
    deletado_em = models.DateTimeField(null=True, blank=True, editable=False)

    objects = ActiveManager()
    all_objects = SoftDeleteQuerySet.as_manager()

    class Meta:
        abstract = True

    def delete(self, using=None, keep_parents=False):
        if self.deletado_em is not None:
            return 0, {}

        self.deletado_em = timezone.now()
        self.save(update_fields=['deletado_em'])
        return 1, {self._meta.label: 1}

    def restore(self):
        if self.deletado_em is not None:
            self.deletado_em = None
            self.save(update_fields=['deletado_em'])
