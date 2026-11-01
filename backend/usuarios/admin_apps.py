from django.contrib.admin.apps import AdminConfig


class LocusAdminConfig(AdminConfig):
    default_site = 'usuarios.admin_site.LocusAdminSite'
