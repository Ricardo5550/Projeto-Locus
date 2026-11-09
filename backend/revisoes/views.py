from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.permissions import IsAuthenticated

from anotacoes.models import Anotacao

from auditoria.services import registrar_atividade
from .models import Pergunta, Tentativa, Questionario
from .questionarios import reiniciar
from .origem import questionario_da_origem
from .serializers import PerguntaSerializer, TentativaSerializer
from .services import excluir_pergunta


class ConfirmacaoReinicioNecessaria(APIException):
    status_code = 409
    default_detail = 'Adicionar esta pergunta reiniciará o agendamento. Seu histórico será preservado. Deseja continuar?'


class PerguntaViewSet(viewsets.ModelViewSet):
    serializer_class = PerguntaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = (
            Pergunta.objects
            .filter(anotacao__autor=self.request.user, anotacao__deletado_em__isnull=True)
            .select_related('anotacao')
            .prefetch_related('tentativas')
            .order_by('-data_criacao')
        )
        anotacao_id = self.request.query_params.get('anotacao')
        if anotacao_id:
            queryset = queryset.filter(anotacao_id=anotacao_id)
        questionario_id = self.request.query_params.get('questionario')
        if questionario_id:
            if not questionario_id.isdigit(): raise ValidationError('Questionário inválido.')
            queryset = queryset.filter(questionario_id=questionario_id)
        return queryset

    @transaction.atomic
    def perform_create(self, serializer):
        dados = serializer.validated_data
        q = dados.get('questionario')
        criado = False
        if q:
            q = get_object_or_404(Questionario.objects.select_for_update(), pk=q.pk, autor=self.request.user)
        else:
            q, criado = questionario_da_origem(dados['anotacao'], dados.get('mapa_origem'), dados.get('visao_origem'))
        anotacao = get_object_or_404(
            Anotacao.objects.select_for_update(), pk=dados['anotacao'].pk, autor=self.request.user,
        )
        if q.ultima_revisao and not dados.get('confirmar_reinicio'):
            raise ConfirmacaoReinicioNecessaria()
        if q.perguntas.count() >= 1000:
            raise ValidationError('Limite de 1000 perguntas por questionário.')
        if criado:
            registrar_atividade(self.request, 'criar', 'questionario', q.pk)
        pergunta = serializer.save(anotacao=anotacao, questionario=q)
        reiniciar(q)
        registrar_atividade(self.request, 'criar', 'pergunta', pergunta.pk)

    @transaction.atomic
    def perform_update(self, serializer):
        dados = serializer.validated_data
        pergunta = serializer.instance
        origem_id = pergunta.questionario_id
        novo_questionario = dados.get('questionario')
        destino_id = novo_questionario.pk if novo_questionario is not None else origem_id
        transferir = origem_id != destino_id

        # Bloqueia os dois questionários em ordem fixa, inclusive em transferências inversas.
        ids = {pk for pk in (origem_id, destino_id) if pk is not None}
        questionarios = {
            q.pk: q for q in Questionario.objects.select_for_update()
            .filter(pk__in=ids, autor=self.request.user).order_by('pk')
        }
        if ids != questionarios.keys():
            raise ValidationError('Questionário indisponível.')

        serializer.instance = get_object_or_404(
            Pergunta.objects.select_for_update(),
            pk=pergunta.pk, questionario_id=origem_id,
        )
        manter = dados.get('manter_agendamento', False) and not transferir
        if not manter and any(q.ultima_revisao for q in questionarios.values()) and not dados.get('confirmar_reinicio'):
            raise ValidationError('Confirme o reinício do agendamento.')
        if transferir and questionarios[destino_id].perguntas.count() >= 1000:
            raise ValidationError('Limite de 1000 perguntas por questionário.')

        pergunta = serializer.save()
        for q in questionarios.values():
            if manter:
                q.versao += 1
                q.save(update_fields=['versao'])
            else:
                reiniciar(q)
        registrar_atividade(self.request, 'editar', 'pergunta', pergunta.pk)

    @transaction.atomic
    def perform_destroy(self, instance):
        q = instance.questionario
        if q:
            q = get_object_or_404(Questionario.objects.select_for_update(), pk=q.pk, autor=self.request.user)
            if q.ultima_revisao and self.request.query_params.get('confirmar_reinicio') != 'true':
                raise ValidationError('Confirme o reinício do agendamento.')
        instance = get_object_or_404(
            Pergunta.objects.select_for_update(), pk=instance.pk, questionario_id=instance.questionario_id,
        )
        identificador = instance.pk
        excluir_pergunta(instance)
        if q: reiniciar(q)
        registrar_atividade(self.request, 'excluir', 'pergunta', identificador)


class TentativaViewSet(viewsets.ModelViewSet):
    serializer_class = TentativaSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'head', 'options']

    def get_queryset(self):
        queryset = (
            Tentativa.objects
            .filter(
                pergunta__anotacao__autor=self.request.user,
                pergunta__deletado_em__isnull=True,
                pergunta__anotacao__deletado_em__isnull=True,
            )
            .select_related('pergunta', 'pergunta__anotacao')
        )
        pergunta_id = self.request.query_params.get('pergunta')
        if pergunta_id:
            queryset = queryset.filter(pergunta_id=pergunta_id)
        return queryset

    @transaction.atomic
    def perform_create(self, serializer):
        tentativa = serializer.save()
        registrar_atividade(self.request, 'responder', 'tentativa', tentativa.pk)
