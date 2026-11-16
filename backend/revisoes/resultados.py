from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import SessaoRevisao, Questionario


class FiltroPeriodo(serializers.Serializer):
    inicio = serializers.DateField(required=False)
    fim = serializers.DateField(required=False)

    def validate(self, dados):
        if dados.get('inicio') and dados.get('fim') and dados['inicio'] > dados['fim']:
            raise ValidationError('A data inicial não pode ser posterior à data final.')
        return dados


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def resultados(request):
    sessoes_filtradas = SessaoRevisao.objects.filter(
        autor=request.user, treino=False, questionario__deletado_em__isnull=True
    ).select_related('materia')
    por_questionario = request.query_params.get('agrupamento') == 'questionario'
    questionario = request.query_params.get('questionario')
    if questionario:
        filtro = serializers.UUIDField()
        questionario = filtro.run_validation(questionario)
        sessoes_filtradas = sessoes_filtradas.filter(questionario_id=questionario)
    if por_questionario:
        sessoes_filtradas = sessoes_filtradas.select_related('questionario')
    materia = request.query_params.get('materia')
    if materia:
        materia = serializers.UUIDField().run_validation(materia)
        sessoes_filtradas = sessoes_filtradas.filter(materia_id=materia)
    periodo = FiltroPeriodo(data=request.query_params)
    periodo.is_valid(raise_exception=True)
    datas = periodo.validated_data
    if 'inicio' in datas:
        sessoes_filtradas = sessoes_filtradas.filter(
            data_criacao__date__gte=datas['inicio']
        )
    if 'fim' in datas:
        sessoes_filtradas = sessoes_filtradas.filter(
            data_criacao__date__lte=datas['fim']
        )
    barras, linha = {}, {}
    total = acertos = parciais = total_sessoes = 0
    for sessao in sessoes_filtradas:
        if por_questionario:
            identificador, nome = sessao.questionario_id, sessao.questionario.titulo
        else:
            identificador, nome = sessao.materia_id, (
                sessao.materia.nome if sessao.materia else 'Sem matéria'
            )
        item = barras.setdefault(
            identificador,
            {
                'id': identificador,
                'nome': nome,
                'total': 0,
                'acertos': 0,
                'parciais': 0,
            },
        )
        dia = timezone.localtime(sessao.data_criacao).date().isoformat()
        ponto = linha.setdefault(dia, {'data': dia, 'total': 0, 'acertos': 0})
        for alvo in [item, ponto]:
            alvo['total'] += sessao.total
            alvo['acertos'] += sessao.acertos
        item['parciais'] += sessao.parciais
        total += sessao.total
        acertos += sessao.acertos
        parciais += sessao.parciais
        total_sessoes += 1
    pendentes = (
        Questionario.objects.filter(autor=request.user)
        .filter(
            perguntas__deletado_em__isnull=True,
            perguntas__anotacao__deletado_em__isnull=True,
        )
        .exclude(perguntas=None)
        .distinct()
    )
    if materia:
        pendentes = pendentes.filter(materia_id=materia)
    if questionario:
        pendentes = pendentes.filter(pk=questionario)
    return Response(
        {
            'barras': list(barras.values()),
            'linha': sorted(linha.values(), key=lambda p: p['data']),
            'total': total,
            'acertos': acertos,
            'parciais': parciais,
            'sessoes': total_sessoes,
            'hoje': pendentes.filter(proxima_revisao=timezone.localdate()).count(),
            'atrasadas': pendentes.filter(
                proxima_revisao__lt=timezone.localdate()
            ).count(),
        }
    )
