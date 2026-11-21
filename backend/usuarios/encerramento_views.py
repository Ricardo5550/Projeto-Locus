from django.core.exceptions import ValidationError as ErroValidacaoDjango
from rest_framework import serializers
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError

from .cookies import limpar_cookies
from .equipe import solicitar_encerramento
from .models import SolicitacaoEncerramentoAdmin


class EncerramentoAdministrativoView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        pedido = SolicitacaoEncerramentoAdmin.objects.filter(usuario=request.user, concluida_em__isnull=True).first()
        resposta = Response({'pedido': {'id': pedido.pk, 'criada_em': pedido.criada_em, 'motivo': pedido.motivo} if pedido else None})
        resposta['Cache-Control'] = 'no-store'
        return resposta

    def post(self, request):
        class Dados(serializers.Serializer):
            password = serializers.CharField(max_length=1024, trim_whitespace=False)
            motivo = serializers.CharField(min_length=5, max_length=300)
        dados = Dados(data=request.data)
        dados.is_valid(raise_exception=True)
        try:
            solicitar_encerramento(request, dados.validated_data['password'], dados.validated_data['motivo'])
        except ErroValidacaoDjango as erro:
            raise ValidationError({'detail': erro.messages}) from erro
        return limpar_cookies(Response({'detail': 'Pedido de encerramento registrado e sessões encerradas. Outro supremo deverá concluir o procedimento. A conta permanece ativa até a conclusão.'}, status=201))
