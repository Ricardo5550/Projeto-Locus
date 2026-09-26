"""
URL configuration for locus project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from anotacoes.views import AnotacaoViewSet
from mapas.views import MapaMentalViewSet
from usuarios.views import EstudanteViewSet
from revisoes.views import PerguntaViewSet, TentativaViewSet
from django.conf import settings
from django.conf.urls.static import static
from referencias.views import buscar_referencias

router = DefaultRouter()
router.register(r'anotacoes', AnotacaoViewSet)
router.register(r'mapas-mentais', MapaMentalViewSet)
router.register(r'estudantes', EstudanteViewSet)
router.register(r'perguntas', PerguntaViewSet)
router.register(r'tentativas', TentativaViewSet)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api/referencias/', buscar_referencias, name='buscar-referencias'),
    path('api/auth/', include('dj_rest_auth.urls')),
    path('api/auth/registro/', include('dj_rest_auth.registration.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)