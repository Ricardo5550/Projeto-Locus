from django.conf import settings
from django.views.generic import RedirectView
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from dj_rest_auth.registration.views import (
    RegisterView,
    ResendEmailVerificationView,
    VerifyEmailView,
)
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from anotacoes.views import AnotacaoViewSet
from mapas.views import MapaMentalViewSet
from referencias.views import buscar_referencias
from revisoes.views import PerguntaViewSet, TentativaViewSet
from usuarios.views import (
    AccountView,
    EmailConfirmationRedirectView,
    LoginView,
    LogoutView,
    PasswordResetRedirectView,
)

router = DefaultRouter()
router.register(r'anotacoes', AnotacaoViewSet, basename='anotacao')
router.register(r'mapas-mentais', MapaMentalViewSet, basename='mapa-mental')
router.register(r'perguntas', PerguntaViewSet, basename='pergunta')
router.register(r'tentativas', TentativaViewSet, basename='tentativa')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api/referencias/', buscar_referencias, name='buscar-referencias'),

    # Links usados nos e-mails. Eles apenas redirecionam para o SPA.
    path(
        'api/auth/account-confirm-email/<str:key>/',
        EmailConfirmationRedirectView.as_view(),
        name='account_confirm_email',
    ),
    path(
        'api/auth/password/reset/link/<str:uidb64>/<str:token>/',
        PasswordResetRedirectView.as_view(),
        name='password_reset_confirm',
    ),
        path(
        'api/auth/email-verification-sent/',
        RedirectView.as_view(url=settings.FRONTEND_URL),
        name='account_email_verification_sent',
    ),

    # Endpoints explícitos da autenticação do Locus.
    path('api/auth/login/', LoginView.as_view(), name='login'),
    path('api/auth/account/', AccountView.as_view(), name='account'),
    path('api/auth/logout/', LogoutView.as_view(), name='logout'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('api/auth/registro/', RegisterView.as_view(), name='rest_register'),
    path('api/auth/verify-email/', VerifyEmailView.as_view(), name='rest_verify_email'),
    path(
        'api/auth/resend-verification/',
        ResendEmailVerificationView.as_view(),
        name='rest_resend_email',
    ),

    path('api/auth/', include('dj_rest_auth.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
