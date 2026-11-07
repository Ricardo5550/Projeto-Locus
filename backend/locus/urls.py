from django.conf import settings
from django.views.generic import RedirectView
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from usuarios.auth_endpoints import (
    RegisterView,
    ResendEmailVerificationView,
    VerifyEmailView,
    PasswordResetView,
    PasswordResetConfirmView,
    PasswordChangeView,
)
from rest_framework.routers import DefaultRouter
from usuarios.email_views import EmailChangeView, EmailChangeRedirectView, ConfirmEmailChangeView
from usuarios.mfa_views import MFAChallengeView, MFAEnrollmentView, MFAManagementView
from anotacoes.views import AnotacaoViewSet
from mapas.views import MapaMentalViewSet
from pastas.views import PastaViewSet
from referencias.views import buscar_referencias
from revisoes.views import PerguntaViewSet, TentativaViewSet
from acompanhamento.views import (
    AnotacaoCompartilhadaDetalheView,
    MapaCompartilhadoDetalheView,
    AceitarConviteView,
    CriarConviteView,
    ConvitesRecebidosView,
    RecusarConviteView,
    EspacosAcompanhamentoView,
    TutoresEspacoView,
    RemoverTutorView,
    CompartilharAnotacaoView,
    CompartilharMapaView,
    EspacosTutorView,
    MateriaisCompartilhadosEspacoView,
    TutoresDisponiveisView,
    PerfilTutorView,
)
from usuarios.views import (
    AccountView,
    CsrfView,
    CookieRefreshView,
    EmailConfirmationRedirectView,
    LoginView,
    LogoutView,
    PasswordResetRedirectView,
)

router = DefaultRouter()
router.register(r'pastas', PastaViewSet, basename='pasta')
router.register(r'anotacoes', AnotacaoViewSet, basename='anotacao')
router.register(r'mapas-mentais', MapaMentalViewSet, basename='mapa-mental')
router.register(r'perguntas', PerguntaViewSet, basename='pergunta')
router.register(r'tentativas', TentativaViewSet, basename='tentativa')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),

    path(
        'api/acompanhamento/anotacoes/<int:pk>/',
        AnotacaoCompartilhadaDetalheView.as_view(),
        name='acompanhamento-anotacao-detalhe'
    ),

    path(
        'api/acompanhamento/mapas/<int:pk>/',
        MapaCompartilhadoDetalheView.as_view(),
        name='acompanhamento-mapa-detalhe'
    ),

    path(
        'api/acompanhamento/convites/<int:pk>/aceitar/',
        AceitarConviteView.as_view(),
        name='acompanhamento-convite-aceitar'
    ),

    path(
        'api/acompanhamento/convites/',
        CriarConviteView.as_view(),
        name='acompanhamento-convite-criar'
    ),

    path(
        'api/acompanhamento/convites/recebidos/',
        ConvitesRecebidosView.as_view(),
        name='acompanhamento-convites-recebidos'
    ),

    path(
        'api/acompanhamento/convites/<int:pk>/recusar/',
        RecusarConviteView.as_view(),
        name='acompanhamento-convite-recusar'
    ),

    path(
        'api/acompanhamento/espacos/',
        EspacosAcompanhamentoView.as_view(),
        name='acompanhamento-espacos'
    ),

    path(
        'api/acompanhamento/espacos/<int:pk>/tutores/',
        TutoresEspacoView.as_view(),
        name='acompanhamento-espaco-tutores'
    ),

    path(
        'api/acompanhamento/espacos/<int:pk>/tutores/<int:tutor_id>/',
        RemoverTutorView.as_view(),
        name='acompanhamento-remover-tutor'
    ),

    path(
        'api/acompanhamento/espacos/<int:pk>/anotacoes/<int:anotacao_id>/compartilhar/',
        CompartilharAnotacaoView.as_view(),
        name='acompanhamento-compartilhar-anotacao'
    ),

    path(
        'api/acompanhamento/espacos/<int:pk>/mapas/<int:mapa_id>/compartilhar/',
        CompartilharMapaView.as_view(),
        name='acompanhamento-compartilhar-mapa'
    ),

    path(
        'api/acompanhamento/espacos/participando/',
        EspacosTutorView.as_view(),
        name='acompanhamento-espacos-participando'
    ),

    path(
        'api/acompanhamento/espacos/<int:pk>/materiais/',
        MateriaisCompartilhadosEspacoView.as_view(),
        name='acompanhamento-espaco-materiais'
    ),

    path(
        'api/acompanhamento/tutores/disponiveis/',
        TutoresDisponiveisView.as_view(),
        name='acompanhamento-tutores-disponiveis'
    ),

    path(
        'api/acompanhamento/tutores/perfil/',
        PerfilTutorView.as_view(),
        name='acompanhamento-perfil-tutor'
    ),

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
    path('api/auth/csrf/', CsrfView.as_view(), name='csrf'),
    path('api/auth/mfa/verify/', MFAChallengeView.as_view(), name='mfa-verify'),
    path('api/auth/mfa/enroll/', MFAEnrollmentView.as_view(), name='mfa-enroll'),
    path('api/auth/mfa/', MFAManagementView.as_view(), name='mfa-manage'),
    path('api/auth/account/email/', EmailChangeView.as_view(), name='change-email'),
    path('api/auth/account/email/link/', EmailChangeRedirectView.as_view(), name='change-email-link'),
    path('api/auth/account/email/confirm/', ConfirmEmailChangeView.as_view(), name='confirm-email-change'),
    re_path(r'^api/auth/login/?$', LoginView.as_view(), name='login'),
    path('api/auth/account/', AccountView.as_view(), name='account'),
    re_path(r'^api/auth/logout/?$', LogoutView.as_view(), name='logout'),
    re_path(r'^api/auth/token/refresh/?$', CookieRefreshView.as_view(), name='token-refresh'),
    path('api/auth/registro/', RegisterView.as_view(), name='rest_register'),
    path('api/auth/verify-email/', VerifyEmailView.as_view(), name='rest_verify_email'),
    path(
        'api/auth/resend-verification/',
        ResendEmailVerificationView.as_view(),
        name='rest_resend_email',
    ),

    # Exponha somente as operações utilizadas. A inclusão genérica também
    # publicava outro login sem barra, fora dos controles do Locus.
    path('api/auth/password/reset/', PasswordResetView.as_view(), name='rest_password_reset'),
    path('api/auth/password/reset/confirm/', PasswordResetConfirmView.as_view(), name='rest_password_reset_confirm'),
    path('api/auth/password/change/', PasswordChangeView.as_view(), name='rest_password_change'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)