from datetime import timedelta, date
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from auditoria.services import registrar_atividade
from core.paginacao import obter_pagina, responder_pagina
from notificacoes.models import Notificacao
from .models import Materia, Questionario, Pergunta, SessaoRevisao
from .agendamento import calcular_revisao


def reiniciar(questionario):
    questionario.versao += 1
    questionario.facilidade = '2.50'
    questionario.sucessos = questionario.intervalo = 0
    if questionario.ultima_revisao:
        amanha = timezone.localdate() + timedelta(days=1)
        questionario.proxima_revisao = min(questionario.proxima_revisao or amanha, amanha)
    if not questionario.perguntas.filter(deletado_em__isnull=True, anotacao__deletado_em__isnull=True).exists():
        questionario.proxima_revisao = None
    questionario.save()
    Notificacao.objects.filter(destinatario=questionario.autor, tipo='revisao', recurso_id=questionario.pk).delete()


class MateriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Materia
        fields = ['id', 'nome']

    def validate_nome(self, valor):
        if not valor.strip(): raise ValidationError('Informe o nome da matéria.')
        return valor.strip()


class MateriaViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = MateriaSerializer

    def get_queryset(self): return Materia.objects.filter(autor=self.request.user)
    def perform_create(self, serializer): serializer.save(autor=self.request.user)

    def perform_destroy(self, instance):
        if Questionario.objects.filter(materia=instance).exists():
            raise ValidationError('Mova os questionários para outra matéria antes de excluir.')
        instance.delete()


class QuestionarioSerializer(serializers.ModelSerializer):
    materia_nome = serializers.CharField(source='materia.nome', default='', read_only=True)
    total_perguntas = serializers.SerializerMethodField()
    class Meta:
        model = Questionario
        fields = ['id', 'titulo', 'materia', 'materia_nome', 'pasta', 'versao', 'limite_dias', 'facilidade', 'sucessos', 'intervalo', 'proxima_revisao', 'ultima_revisao', 'total_perguntas']
        read_only_fields = ['versao', 'facilidade', 'sucessos', 'intervalo', 'proxima_revisao', 'ultima_revisao']

    def get_total_perguntas(self, obj):
        return obj.perguntas.filter(deletado_em__isnull=True, anotacao__deletado_em__isnull=True).count()

    def validate_titulo(self, value):
        if not value.strip(): raise ValidationError('Informe o título.')
        return value.strip()

    def validate_materia(self, value):
        if value and (value.autor_id != self.context['request'].user.pk or value.deletado_em): raise ValidationError('Matéria inválida.')
        return value

    def validate_pasta(self, value):
        if value and (value.autor_id != self.context['request'].user.pk or value.deletado_em): raise ValidationError('Pasta inválida.')
        return value

    def validate_limite_dias(self, value):
        if value is not None and not 1 <= value <= 36500: raise ValidationError('Informe entre 1 e 36500 dias, ou selecione sem limite.')
        return value


class RespostaSerializer(serializers.Serializer):
    pergunta = serializers.IntegerField(min_value=1)
    resposta_digitada = serializers.CharField(allow_blank=True, max_length=20000, trim_whitespace=False)
    resultado = serializers.ChoiceField(choices=['errei', 'parcial', 'acertei'])


class FinalizacaoSerializer(serializers.Serializer):
    chave = serializers.UUIDField()
    versao = serializers.IntegerField(min_value=1)
    treino = serializers.BooleanField(default=False)
    respostas = RespostaSerializer(many=True, allow_empty=False, max_length=1000)


def sessao_json(sessao):
    respostas = sessao.respostas
    from anotacoes.models import Anotacao
    ids = [r['anotacao'] for r in respostas if r.get('anotacao')]
    disponiveis = set(Anotacao.objects.filter(autor=sessao.autor, pk__in=ids).values_list('pk', flat=True))
    return {'id': sessao.pk, 'versao': sessao.versao, 'treino': sessao.treino, 'data_criacao': sessao.data_criacao,
            'acertos': sessao.acertos, 'parciais': sessao.parciais, 'total': sessao.total, 'qualidade': sessao.qualidade,
            'pontuacao': 100*(sessao.acertos+0.5*sessao.parciais)/sessao.total,
            'respostas': [{**r, 'anotacao_disponivel': r.get('anotacao') in disponiveis} for r in respostas]}


class FiltrosQuestionarios(serializers.Serializer):
    busca = serializers.CharField(required=False, allow_blank=True, max_length=150)
    materia = serializers.IntegerField(required=False, min_value=1, max_value=2**63 - 1)
    pasta = serializers.IntegerField(required=False, min_value=1, max_value=2**63 - 1)
    situacao = serializers.ChoiceField(choices=('hoje', 'atrasadas', 'novos'), required=False)


class QuestionarioViewSet(viewsets.ModelViewSet):
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
        return responder_pagina(pagina, self.get_serializer(pagina.object_list, many=True).data)

    def perform_create(self, serializer):
        q = serializer.save(autor=self.request.user)
        registrar_atividade(self.request, 'criar', 'questionario', q.pk)

    @transaction.atomic
    def update(self, request, *args, **kwargs): return super().update(request, *args, **kwargs)

    def perform_update(self, serializer):
        # Alteração do limite entra em vigor na próxima conclusão; não muda a agenda atual.
        q = serializer.save()
        registrar_atividade(self.request, 'editar', 'questionario', q.pk)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs): return super().destroy(request, *args, **kwargs)

    def perform_destroy(self, instance):
        from .services import excluir_pergunta
        for pergunta in instance.perguntas.filter(deletado_em__isnull=True):
            excluir_pergunta(pergunta)
        instance.sessoes.all().delete()
        Notificacao.objects.filter(destinatario=instance.autor, tipo='revisao', recurso_id=instance.pk).delete()
        instance.delete()
        registrar_atividade(self.request, 'excluir', 'questionario', instance.pk)

    @action(detail=True, methods=['get'])
    def devolutiva(self, request, pk=None):
        q = self.get_object()
        sessoes = q.sessoes.all()
        if request.query_params.get('incluir_treino') != 'true':
            sessoes = sessoes.filter(treino=False)
        s = sessoes.first()
        return Response(sessao_json(s) if s else {'vazia': True})

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def finalizar(self, request, pk=None):
        q = self.get_object()
        serializer = FinalizacaoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dados = serializer.validated_data
        anterior = SessaoRevisao.objects.filter(autor=request.user, chave=dados['chave']).first()
        if anterior:
            if anterior.questionario_id != q.pk: raise ValidationError('Chave de sessão já utilizada.')
            return Response(sessao_json(anterior))
        if q.versao != dados['versao']: return Response({'detail': 'O questionário foi alterado. Reabra a sessão antes de finalizar.'}, status=409)
        perguntas = list(q.perguntas.filter(deletado_em__isnull=True, anotacao__deletado_em__isnull=True).select_related('anotacao').order_by('pk'))
        respostas = dados['respostas']
        por_id = {r['pergunta']: r for r in respostas}
        if not perguntas or len(por_id) != len(respostas) or set(por_id) != {p.pk for p in perguntas}:
            raise ValidationError('Responda e classifique todas as perguntas uma única vez.')
        treino = dados['treino']
        hoje = timezone.localdate()
        if not treino and q.proxima_revisao and q.proxima_revisao > hoje:
            raise ValidationError('A revisão ainda não venceu. Utilize o treino livre.')
        copias = [{**por_id[p.pk], 'enunciado': p.enunciado, 'resposta': p.resposta, 'anotacao': p.anotacao_id, 'titulo_anotacao': p.anotacao.titulo} for p in perguntas]
        acertos = sum(r['resultado'] == 'acertei' for r in respostas)
        parciais = sum(r['resultado'] == 'parcial' for r in respostas)
        qualidade, facilidade, sucessos, intervalo = calcular_revisao(acertos, parciais, len(perguntas), q.facilidade, q.sucessos, q.intervalo, q.limite_dias)
        if not treino and intervalo > (date.max - hoje).days: raise ValidationError('O intervalo excedeu o calendário. Defina um limite máximo para este questionário.')
        s = SessaoRevisao.objects.create(questionario=q, autor=request.user, materia_id=q.materia_id, chave=dados['chave'], versao=q.versao,
            treino=treino, respostas=copias, acertos=acertos, parciais=parciais, total=len(perguntas), qualidade=qualidade)
        if not treino:
            q.facilidade, q.sucessos, q.intervalo = facilidade, sucessos, intervalo
            q.ultima_revisao = timezone.now()
            q.proxima_revisao = hoje + timedelta(days=intervalo)
            q.save()
            Notificacao.objects.filter(destinatario=request.user, tipo='revisao', recurso_id=q.pk).delete()
            registrar_atividade(request, 'finalizar_revisao', 'questionario', q.pk)
        return Response(sessao_json(s), status=201)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def resultados(request):
    qs = SessaoRevisao.objects.filter(autor=request.user, treino=False, questionario__deletado_em__isnull=True).select_related('materia')
    por_questionario = request.query_params.get('agrupamento') == 'questionario'
    questionario = request.query_params.get('questionario')
    if questionario:
        filtro = serializers.IntegerField(min_value=1, max_value=2**63 - 1)
        questionario = filtro.run_validation(questionario)
        qs = qs.filter(questionario_id=questionario)
    if por_questionario:
        qs = qs.select_related('questionario')
    materia = request.query_params.get('materia')
    if materia:
        if not materia.isdigit(): raise ValidationError('Matéria inválida.')
        qs = qs.filter(materia_id=int(materia))
    for param, lookup in [('inicio', 'data_criacao__date__gte'), ('fim', 'data_criacao__date__lte')]:
        if request.query_params.get(param):
            try: valor = date.fromisoformat(request.query_params[param])
            except ValueError: raise ValidationError('Data inválida.')
            qs = qs.filter(**{lookup: valor})
    barras, linha = {}, {}
    total = acertos = parciais = sessoes = 0
    for s in qs:
        if por_questionario:
            identificador, nome = s.questionario_id, s.questionario.titulo
        else:
            identificador, nome = s.materia_id, s.materia.nome if s.materia else 'Sem matéria'
        item = barras.setdefault(identificador, {'id': identificador, 'nome': nome, 'total': 0, 'acertos': 0, 'parciais': 0})
        dia = timezone.localtime(s.data_criacao).date().isoformat()
        ponto = linha.setdefault(dia, {'data': dia, 'total': 0, 'acertos': 0})
        for alvo in [item, ponto]:
            alvo['total'] += s.total; alvo['acertos'] += s.acertos
        item['parciais'] += s.parciais
        total += s.total; acertos += s.acertos; parciais += s.parciais; sessoes += 1
    pendentes = Questionario.objects.filter(autor=request.user).exclude(perguntas=None).distinct()
    if materia: pendentes = pendentes.filter(materia_id=int(materia))
    if questionario: pendentes = pendentes.filter(pk=questionario)
    return Response({'barras': list(barras.values()), 'linha': sorted(linha.values(), key=lambda p: p['data']),
        'total': total, 'acertos': acertos, 'parciais': parciais, 'sessoes': sessoes,
        'hoje': pendentes.filter(proxima_revisao=timezone.localdate()).count(), 'atrasadas': pendentes.filter(proxima_revisao__lt=timezone.localdate()).count()})
