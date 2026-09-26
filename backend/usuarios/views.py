from rest_framework import viewsets
from rest_framework import generics
from rest_framework.permissions import AllowAny
from .models import Estudante
from .serializers import EstudanteSerializer
from .serializers import RegistroSerializer
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.conf import settings
from django.contrib.auth import authenticate
import requests

# Create your views here.
class EstudanteViewSet(viewsets.ModelViewSet):
    queryset = Estudante.objects.all().order_by('-id')
    serializer_class = EstudanteSerializer

class RegistroEstudanteView(generics.CreateAPIView):
    queryset = Estudante.objects.all()
    serializer_class = RegistroSerializer
    permission_classes = [AllowAny]

class LoginView(APIView):
    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        captcha_token = request.data.get('captcha_token')
        recaptcha_response = requests.post(
                    'https://www.google.com/recaptcha/api/siteverify',
                    data={
                        'secret': settings.RECAPTCHA_SECRET_KEY,
                        'response': captcha_token
                    }
                )
        resultado_google = recaptcha_response.json()
        if not resultado_google.get('success'):
                return Response({'error': 'Falha na verificação do reCAPTCHA'}, status=400)
        user = authenticate(request, username=email, password=password)

        if user is not None:
            refresh = RefreshToken.for_user(user)
            return Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            })
        else:
            return Response({'error': 'Credenciais inválidas'}, status=401)
