"""Cota dos conteúdos por conta, medida nos valores já armazenados no banco."""
from django.apps import apps
from django.contrib.auth import get_user_model
from django.db import models, transaction
from django.db.models.functions import Coalesce
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response


LIMITE_BYTES = 60 * 1024 * 1024
# Reserva estimada por registro; índices e estruturas internas do banco são globais.
RESERVA_REGISTRO = 64
MENSAGEM_LIMITE = (
    'Esta ação ultrapassa o limite de 60 MB da sua conta e não foi concluída. '
    'Exclua conteúdos que não utiliza ou reduza as imagens e tente novamente. '
    'As alterações desta ação não foram salvas.'
)

# Inclui registros excluídos logicamente: o que permanece no banco ainda ocupa espaço.
# Conteúdos compartilhados são contados na origem, sem duplicar o material.
CONTEUDOS = (
    ('anotacoes.Anotacao', 'autor_id'),
    ('mapas.MapaMental', 'autor_id'),
    ('pastas.Pasta', 'autor_id'),
    ('revisoes.Materia', 'autor_id'),
    ('revisoes.Questionario', 'autor_id'),
    ('revisoes.Pergunta', 'anotacao__autor_id'),
    ('revisoes.Tentativa', 'pergunta__anotacao__autor_id'),
    ('revisoes.SessaoRevisao', 'autor_id'),
    ('acompanhamento.PerfilTutor', 'usuario_id'),
    ('acompanhamento.EspacoAcompanhamento', 'proprietario_id'),
    ('acompanhamento.Convite', 'solicitado_por_id'),
    ('acompanhamento.Participacao', 'tutor__usuario_id'),
    ('acompanhamento.AnotacaoCompartilhada', 'espaco__proprietario_id'),
    ('acompanhamento.MapaCompartilhado', 'espaco__proprietario_id'),
    ('acompanhamento.QuestionarioCompartilhado', 'espaco__proprietario_id'),
    ('acompanhamento.MensagemAcompanhamento', 'autor_id'),
)


class TamanhoBytes(models.Func):
    """Não descriptografa nem transfere os conteúdos para medir seu tamanho."""
    function = 'OCTET_LENGTH'
    template = '%(function)s(CAST(%(expressions)s AS TEXT))'
    output_field = models.BigIntegerField()

    def as_sqlite(self, compiler, connection, **extra_context):
        return self.as_sql(
            compiler, connection, function='LENGTH',
            template='%(function)s(CAST(%(expressions)s AS BLOB))', **extra_context,
        )


def uso_bytes(usuario_id):
    total = 0
    for nome, proprietario in CONTEUDOS:
        modelo = apps.get_model(nome)
        manager = getattr(modelo, 'all_objects', modelo._base_manager)
        tamanho = models.Value(RESERVA_REGISTRO, output_field=models.BigIntegerField())
        for campo in modelo._meta.concrete_fields:
            tamanho += Coalesce(TamanhoBytes(models.F(campo.attname)), 0)
        consulta = manager.filter(**{proprietario: usuario_id})
        total += consulta.aggregate(total=models.Sum(tamanho))['total'] or 0
    return total


class LimiteArmazenamentoMixin:
    """Confere a operação inteira e desfaz seus efeitos quando excede a cota.

    O bloqueio da conta serializa gravações concorrentes no PostgreSQL. A medição
    ocorre após autenticação/permissões e antes de qualquer gravação do handler.
    Leituras e exclusões não são bloqueadas por falta de espaço.
    """
    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method in ('POST', 'PUT', 'PATCH', 'DELETE'):
            get_user_model().objects.select_for_update().get(pk=request.user.pk)
            if request.method != 'DELETE':
                self._uso_antes = uso_bytes(request.user.pk)

    def dispatch(self, request, *args, **kwargs):
        if request.method not in ('POST', 'PUT', 'PATCH', 'DELETE'):
            return super().dispatch(request, *args, **kwargs)
        with transaction.atomic():
            resposta = super().dispatch(request, *args, **kwargs)
            if resposta.status_code >= 400:
                transaction.set_rollback(True)
            elif hasattr(self, '_uso_antes'):
                depois = uso_bytes(self.request.user.pk)
                # Contas antigas acima da cota podem diminuir seu uso.
                if depois > LIMITE_BYTES and depois > self._uso_antes:
                    transaction.set_rollback(True)
                    resposta.status_code = 413
                    resposta.data = {
                        'detail': MENSAGEM_LIMITE,
                        'code': 'limite_armazenamento',
                        'limite_bytes': LIMITE_BYTES,
                        'usado_bytes': self._uso_antes,
                    }
                    resposta['Cache-Control'] = 'no-store'
            return resposta


class ArmazenamentoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        usado = uso_bytes(request.user.pk)
        resposta = Response({
            'usado_bytes': usado, 'limite_bytes': LIMITE_BYTES,
            'disponivel_bytes': max(0, LIMITE_BYTES - usado),
        })
        resposta['Cache-Control'] = 'no-store'
        return resposta
