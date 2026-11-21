from core.armazenamento import LimiteArmazenamentoMixin
from datetime import timedelta, date
from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from auditoria.services import registrar_atividade
from core.paginacao import obter_pagina, responder_pagina
from notificacoes.models import Notificacao
from .models import Materia, Questionario, SessaoRevisao
from .agendamento import calcular_revisao
from .serializers import (
    MateriaSerializer,
    QuestionarioSerializer,
    FinalizacaoSerializer,
    FiltrosQuestionarios,
)


class MateriaViewSet(LimiteArmazenamentoMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = MateriaSerializer

    def get_queryset(self):
        return Materia.objects.filter(autor=self.request.user)

    def perform_create(self, serializer):
        serializer.save(autor=self.request.user)

    def perform_destroy(self, instance):
        if Questionario.objects.filter(materia=instance).exists():
            raise ValidationError(
                'Mova os questionários para outra matéria antes de excluir.'
            )
        instance.delete()


def sessao_json(sessao):
    respostas = sessao.respostas
    from anotacoes.models import Anotacao

    ids = [resposta['anotacao'] for resposta in respostas if resposta.get('anotacao')]
    disponiveis = {
        str(pk)
        for pk in Anotacao.objects.filter(autor=sessao.autor, pk__in=ids).values_list(
            'pk', flat=True
        )
    }
    return {
        'id': sessao.pk,
        'versao': sessao.versao,
        'treino': sessao.treino,
        'data_criacao': sessao.data_criacao,
        'acertos': sessao.acertos,
        'parciais': sessao.parciais,
        'total': sessao.total,
        'qualidade': sessao.qualidade,
        'pontuacao': 100 * (sessao.acertos + 0.5 * sessao.parciais) / sessao.total,
        'respostas': [
            {
                **resposta,
                'anotacao_disponivel': str(resposta.get('anotacao')) in disponiveis,
            }
            for resposta in respostas
        ],
    }


class QuestionarioViewSet(LimiteArmazenamentoMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = QuestionarioSerializer

    def get_queryset(self):
        qs = Questionario.objects.filter(autor=self.request.user)
        if self.action in ('update', 'partial_update', 'destroy', 'finalizar'):
            return qs.select_for_update()
        return qs.select_related('materia', 'pasta')

    @action(detail=False, methods=['get'])
    def paginados(self, request):
        filtros = FiltrosQuestionarios(data=request.query_params)
        filtros.is_valid(raise_exception=True)
        valores = filtros.validated_data

        qs = self.get_queryset().filter(titulo__icontains=valores.get('busca', ''))
        for campo in ('materia', 'pasta'):
            if campo in valores:
                qs = qs.filter(**{f'{campo}_id': valores[campo]})
        hoje = timezone.localdate()
        situacao = valores.get('situacao')
        if situacao == 'hoje':
            qs = qs.filter(proxima_revisao=hoje)
        elif situacao == 'atrasadas':
            qs = qs.filter(proxima_revisao__lt=hoje)
        elif situacao == 'novos':
            qs = qs.filter(ultima_revisao__isnull=True)
        pagina = obter_pagina(request, qs.order_by('titulo', 'pk'))
        return responder_pagina(
            pagina, self.get_serializer(pagina.object_list, many=True).data
        )

    def perform_create(self, serializer):
        questionario = serializer.save(autor=self.request.user)
        registrar_atividade(self.request, 'criar', 'questionario', questionario.pk)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)

    def perform_update(self, serializer):
        # Alteração do limite entra em vigor na próxima conclusão; não muda a agenda atual.
        questionario = serializer.save()
        registrar_atividade(self.request, 'editar', 'questionario', questionario.pk)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)

    def perform_destroy(self, instance):
        from .services import excluir_pergunta

        for pergunta in instance.perguntas.filter(deletado_em__isnull=True):
            excluir_pergunta(pergunta)
        instance.sessoes.all().delete()
        Notificacao.objects.filter(
            destinatario=instance.autor, tipo='revisao', recurso_id=instance.pk
        ).delete()
        instance.delete()
        registrar_atividade(self.request, 'excluir', 'questionario', instance.pk)

    @action(detail=True, methods=['get'])
    def devolutiva(self, request, pk=None):
        questionario = self.get_object()
        sessoes = questionario.sessoes.all()
        if request.query_params.get('incluir_treino') != 'true':
            sessoes = sessoes.filter(treino=False)
        sessao = sessoes.first()
        return Response(
            sessao_json(sessao) if sessao and sessao.respostas else {'vazia': True}
        )

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def finalizar(self, request, pk=None):
        questionario = self.get_object()
        serializer = FinalizacaoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dados = serializer.validated_data
        anterior = SessaoRevisao.objects.filter(
            autor=request.user, chave=dados['chave']
        ).first()
        if anterior:
            if anterior.questionario_id != questionario.pk:
                raise ValidationError('Chave de sessão já utilizada.')
            return Response(sessao_json(anterior))
        if questionario.versao != dados['versao']:
            return Response(
                {
                    'detail': 'O questionário foi alterado. Reabra a sessão antes de finalizar.'
                },
                status=409,
            )
        perguntas = list(
            questionario.perguntas.filter(
                deletado_em__isnull=True, anotacao__deletado_em__isnull=True
            )
            .select_related('anotacao')
            .order_by('data_criacao', 'pk')
        )
        respostas = dados['respostas']
        respostas_por_pergunta = {
            resposta['pergunta']: resposta for resposta in respostas
        }
        if (
            not perguntas
            or len(respostas_por_pergunta) != len(respostas)
            or set(respostas_por_pergunta) != {p.pk for p in perguntas}
        ):
            raise ValidationError(
                'Responda e classifique todas as perguntas uma única vez.'
            )
        for pergunta in perguntas:
            resposta = respostas_por_pergunta[pergunta.pk]
            if pergunta.tipo == 'alternativa':
                selecionada = resposta.get('alternativa')
                if selecionada is None or selecionada >= len(pergunta.alternativas):
                    raise ValidationError('Selecione uma alternativa em cada questão objetiva.')
                # A classificação recebida do navegador não decide o resultado.
                resposta['resultado'] = (
                    'acertei' if selecionada == pergunta.alternativa_correta else 'errei'
                )
                resposta['resposta_digitada'] = pergunta.alternativas[selecionada]
            resposta.pop('alternativa', None)
        treino = dados['treino']
        hoje = timezone.localdate()
        if (
            not treino
            and questionario.proxima_revisao
            and questionario.proxima_revisao > hoje
        ):
            raise ValidationError('A revisão ainda não venceu. Utilize o treino livre.')
        respostas_registradas = [
            {
                **respostas_por_pergunta[p.pk],
                'enunciado': p.enunciado,
                'resposta': p.resposta,
                'anotacao': p.anotacao_id,
                'titulo_anotacao': p.anotacao.titulo,
            }
            for p in perguntas
        ]
        acertos = sum(resposta['resultado'] == 'acertei' for resposta in respostas)
        parciais = sum(resposta['resultado'] == 'parcial' for resposta in respostas)
        qualidade, facilidade, sucessos, intervalo = calcular_revisao(
            acertos,
            parciais,
            len(perguntas),
            questionario.facilidade,
            questionario.sucessos,
            questionario.intervalo,
            questionario.limite_dias,
        )
        if not treino and intervalo > (date.max - hoje).days:
            raise ValidationError(
                'O intervalo excedeu o calendário. Defina um limite máximo para este questionário.'
            )
        anterior_id = questionario.sessoes.values_list('pk', flat=True).first()
        sessao = SessaoRevisao.objects.create(
            questionario=questionario,
            autor=request.user,
            materia_id=questionario.materia_id,
            chave=dados['chave'],
            versao=questionario.versao,
            treino=treino,
            respostas=respostas_registradas,
            acertos=acertos,
            parciais=parciais,
            total=len(perguntas),
            qualidade=qualidade,
        )
        if anterior_id is not None:
            questionario.sessoes.filter(pk=anterior_id).update(respostas=[])

        if not treino:
            questionario.facilidade, questionario.sucessos, questionario.intervalo = (
                facilidade,
                sucessos,
                intervalo,
            )
            questionario.ultima_revisao = timezone.now()
            questionario.proxima_revisao = hoje + timedelta(days=intervalo)
            questionario.save()
            Notificacao.objects.filter(
                destinatario=request.user, tipo='revisao', recurso_id=questionario.pk
            ).delete()
            registrar_atividade(
                request, 'finalizar_revisao', 'questionario', questionario.pk
            )
        return Response(sessao_json(sessao), status=201)
