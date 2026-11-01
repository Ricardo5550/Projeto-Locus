from django.conf import settings


def definir_cookies(response, refresh):
    response.set_cookie(settings.JWT_ACCESS_COOKIE, str(refresh.access_token),
        max_age=int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()),
        path='/api/', secure=settings.JWT_COOKIE_SECURE, httponly=True, samesite=settings.JWT_COOKIE_SAMESITE)
    response.set_cookie(settings.JWT_REFRESH_COOKIE, str(refresh),
        max_age=int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()),
        path='/api/auth/', secure=settings.JWT_COOKIE_SECURE, httponly=True, samesite=settings.JWT_COOKIE_SAMESITE)
    response['Cache-Control'] = 'no-store'
    return response


def limpar_cookies(response):
    response.delete_cookie(settings.JWT_ACCESS_COOKIE, path='/api/', samesite=settings.JWT_COOKIE_SAMESITE)
    response.delete_cookie(settings.JWT_REFRESH_COOKIE, path='/api/auth/', samesite=settings.JWT_COOKIE_SAMESITE)
    response['Cache-Control'] = 'no-store'
    return response
