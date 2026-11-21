"""API administrativa. Todas as operações exigem staff e autenticação com 2FA."""
from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied, ValidationError as ErroValidacaoDjango
from django.core.paginator import Paginator
from django.core.validators import URLValidator
from django.db.models import Q
from django.db import IntegrityError
from django.shortcuts import get_object_or_404
from django.urls import path
from allauth.account.models import EmailAddress
from rest_framework import serializers
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from acompanhamento.models import PerfilTutor
from auditoria.models import RegistroAtividade
from auditoria.services import registrar_atividade, ocultar_emails, mascarar_email
from .atendimento import ACOES, atender_conta, decidir_aprovacao
from .gestao_forms import AtendimentoForm, AprovacaoForm
from .mfa import ativo
from .equipe import ACOES_EQUIPE, exigir_gestao_conta, criar_administrador, gerir_equipe, supremos_ativos
from .models import SolicitacaoEncerramentoAdmin
from .legal import apresentar_documento, politica_vigente, termos_vigentes


class GestaoView(APIView):
    # CookieJWTAuthentication valida sessão, aceites e o 2FA obrigatório de staff.
    permission_classes = [IsAdminUser]

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'no-store'
        return response


def validar_formulario(form):
    if not form.is_valid():
        raise ValidationError({campo: list(erros) for campo, erros in form.errors.items()})
    return form.cleaned_data


def paginar(request, queryset, representar):
    class Pagina(serializers.Serializer):
        pagina = serializers.IntegerField(min_value=1, default=1)
    entrada = Pagina(data=request.query_params)
    entrada.is_valid(raise_exception=True)
    pagina = Paginator(queryset, 25).get_page(entrada.validated_data['pagina'])
    return Response({
        'itens': [representar(item) for item in pagina],
        'pagina': pagina.number,
        'total_paginas': pagina.paginator.num_pages,
        'total': pagina.paginator.count,
    })


def resumo_conta(usuario):
    return {
        'id': usuario.pk,
        'nome': ocultar_emails(usuario.username),
        'email_oculto': mascarar_email(usuario.email),
        'ativa': usuario.is_active,
        'administrador': usuario.is_staff,
        'supremo': usuario.is_superuser,
    }


class AcessoView(GestaoView):
    def get(self, request):
        return Response({'administrador': True, 'supremo': request.user.is_superuser})


class ContasView(GestaoView):
    def get(self, request):
        contas = get_user_model().objects.order_by('username', 'pk')
        if not request.user.is_superuser:
            contas = contas.filter(is_staff=False, is_superuser=False)
        busca = request.query_params.get('busca', '').strip()[:150]
        if busca:
            contas = contas.filter(Q(username__icontains=busca) | Q(email__icontains=busca))
        situacao = request.query_params.get('situacao', '')
        if situacao in ('ativa', 'inativa'):
            contas = contas.filter(is_active=situacao == 'ativa')
        return paginar(request, contas, resumo_conta)


class ContaView(GestaoView):
    def get(self, request, usuario_id):
        usuario = get_object_or_404(get_user_model(), pk=usuario_id)
        exigir_gestao_conta(request, usuario)
        confirmado = EmailAddress.objects.filter(
            user=usuario, email__iexact=usuario.email, verified=True,
        ).exists()
        pode_atender = usuario.pk != request.user.pk and (
            request.user.is_superuser or not (usuario.is_staff or usuario.is_superuser)
        )
        acoes = []
        if pode_atender:
            for valor, nome in ACOES.items():
                if valor == 'reenviar_confirmacao' and (confirmado or not usuario.is_active):
                    continue
                if valor in ('suspender', 'enviar_recuperacao') and not usuario.is_active:
                    continue
                if valor == 'reativar' and (usuario.is_active or not usuario.has_usable_password()):
                    continue
                acoes.append({'valor': valor, 'nome': nome})
        pedido = SolicitacaoEncerramentoAdmin.objects.filter(usuario=usuario, concluida_em__isnull=True).first()
        if pode_atender and request.user.is_superuser and usuario.is_staff:
            acoes.append({'valor': 'rebaixar_admin' if usuario.is_superuser else 'promover_supremo', 'nome': 'Retirar privilégio de supremo' if usuario.is_superuser else 'Promover a administrador supremo'})
            if pedido:
                acoes.append({'valor': 'concluir_encerramento', 'nome': 'Concluir encerramento solicitado'})
        ultimo = usuario.is_active and usuario.is_staff and usuario.is_superuser and supremos_ativos().count() <= 1
        if ultimo:
            acoes = [item for item in acoes if item['valor'] not in ('suspender', 'rebaixar_admin', 'concluir_encerramento')]
        return Response({
            'ultimo_supremo': ultimo,
            'pedido_encerramento': {'id': pedido.pk, 'motivo': pedido.motivo, 'criada_em': pedido.criada_em} if pedido else None,
            **resumo_conta(usuario), 'email_confirmado': confirmado, 'mfa_ativo': ativo(usuario),
            'cadastro': usuario.date_joined, 'ultimo_acesso': usuario.last_login,
            'pode_atender': pode_atender, 'acoes': acoes,
        })

    def post(self, request, usuario_id):
        usuario = get_object_or_404(get_user_model(), pk=usuario_id)
        exigir_gestao_conta(request, usuario)
        dados = validar_formulario(AtendimentoForm(request.data))
        acao, motivo = dados['acao'], dados['motivo']
        if acao == 'revelar_email':
            # Só retorna o endereço depois que o registro de auditoria for gravado.
            registrar_atividade(request, 'admin_revelar_email', 'conta', usuario.pk, descricao=motivo)
            return Response({'email': usuario.email, 'detail': 'Consulta do e-mail registrada.'})
        try:
            if acao in ACOES_EQUIPE:
                gerir_equipe(request, usuario.pk, acao, motivo, dados['senha_atual'])
            else:
                atender_conta(request, usuario.pk, acao, motivo)
        except ErroValidacaoDjango as erro:
            raise ValidationError({'detail': erro.messages}) from erro
        except (PermissionDenied, APIException):
            raise
        except Exception:
            return Response({'detail': 'Não foi possível concluir o atendimento. Consulte a auditoria.'}, status=503)
        return Response({'detail': 'Atendimento concluído.'})


def resumo_tutor(perfil):
    return {
        'id': perfil.pk, 'nome': ocultar_emails(perfil.nome_apresentacao),
        'usuario': ocultar_emails(perfil.usuario.username),
        'area': perfil.get_area_display(), 'aprovado': perfil.aprovado, 'situacao': perfil.situacao,
        'ativo': perfil.ativo, 'conta_ativa': perfil.usuario.is_active,
        'criado_em': perfil.criado_em,
    }


class TutoresView(GestaoView):
    def get(self, request):
        perfis = PerfilTutor.objects.select_related('usuario').order_by('aprovado', '-criado_em', 'pk')
        busca = request.query_params.get('busca', '').strip()[:150]
        if busca:
            perfis = perfis.filter(Q(nome_apresentacao__icontains=busca) | Q(usuario__username__icontains=busca))
        situacao = request.query_params.get('situacao', '')
        if situacao == 'aprovado':
            perfis = perfis.filter(aprovado=True)
        elif situacao in ('pendente', 'rejeitado'):
            perfis = perfis.filter(aprovado=False, rejeitado_em__isnull=situacao == 'pendente')
        return paginar(request, perfis, resumo_tutor)


class TutorView(GestaoView):
    def get(self, request, perfil_id):
        perfil = get_object_or_404(PerfilTutor.objects.select_related('usuario'), pk=perfil_id)
        validar_url = URLValidator(schemes=['http', 'https'])
        formacoes = []
        for item in perfil.formacoes:
            link = item.get('link_comprovante', '')
            try:
                validar_url(link)
            except ErroValidacaoDjango:
                link = ''
            formacoes.append({
                'titulo': ocultar_emails(item.get('titulo', '')),
                'instituicao': ocultar_emails(item.get('instituicao', '')),
                'link': link,
            })
        return Response({**resumo_tutor(perfil), 'descricao': ocultar_emails(perfil.descricao), 'motivo_rejeicao': ocultar_emails(perfil.motivo_rejeicao), 'formacoes': formacoes})

    def post(self, request, perfil_id):
        get_object_or_404(PerfilTutor, pk=perfil_id)
        dados = validar_formulario(AprovacaoForm(request.data))
        try:
            decidir_aprovacao(request, perfil_id, dados['aprovado'], dados['motivo'])
        except ErroValidacaoDjango as erro:
            raise ValidationError({'detail': erro.messages}) from erro
        return Response({'detail': 'Aprovação atualizada.'})


class Periodo(serializers.Serializer):
    inicio = serializers.DateField(required=False)
    fim = serializers.DateField(required=False)

    def validate(self, dados):
        if dados.get('inicio') and dados.get('fim') and dados['inicio'] > dados['fim']:
            raise ValidationError('A data inicial não pode ser posterior à data final.')
        return dados


class AuditoriaOpcoesView(GestaoView):
    def get(self, request):
        return Response({
            'acoes': list(RegistroAtividade.objects.order_by('acao').values_list('acao', flat=True).distinct()),
            'recursos': list(RegistroAtividade.objects.order_by('recurso').values_list('recurso', flat=True).distinct()),
        })


class AuditoriaView(GestaoView):
    def get(self, request):
        registros = RegistroAtividade.objects.select_related('usuario').all()
        for parametro in ('acao', 'recurso', 'resultado'):
            valor = request.query_params.get(parametro, '').strip()[:64]
            if valor:
                registros = registros.filter(**{parametro: valor})
        entrada = {campo: request.query_params[campo] for campo in ('inicio', 'fim') if request.query_params.get(campo)}
        periodo = Periodo(data=entrada)
        periodo.is_valid(raise_exception=True)
        for campo, lookup in [('inicio', 'data_hora__date__gte'), ('fim', 'data_hora__date__lte')]:
            if periodo.validated_data.get(campo):
                registros = registros.filter(**{lookup: periodo.validated_data[campo]})
        busca = request.query_params.get('busca', '').strip()[:150]
        if busca:
            registros = registros.filter(Q(usuario__username__icontains=busca) | Q(acao__icontains=busca))
        return paginar(request, registros, lambda registro: {
            'id': registro.pk, 'data': registro.data_hora,
            'responsavel': ocultar_emails(registro.usuario.username) if registro.usuario else 'Não autenticado / sistema',
            'acao': ocultar_emails(registro.acao), 'recurso': ocultar_emails(registro.recurso),
            'recurso_id': registro.recurso_id, 'resultado': registro.resultado,
            'ip': registro.endereco_ip, 'descricao': ocultar_emails(registro.descricao),
        })


class AdministradoresView(GestaoView):
    def post(self, request):
        if not request.user.is_superuser:
            raise PermissionDenied('Somente um supremo pode cadastrar administradores.')
        class Dados(serializers.Serializer):
            username = serializers.CharField(max_length=150)
            email = serializers.EmailField(max_length=254)
            password = serializers.CharField(max_length=1024, trim_whitespace=False)
            confirmacao = serializers.CharField(max_length=1024, trim_whitespace=False)
            senha_atual = serializers.CharField(max_length=1024, trim_whitespace=False)
        entrada = Dados(data=request.data)
        entrada.is_valid(raise_exception=True)
        dados = entrada.validated_data
        if dados.pop('confirmacao') != dados['password']:
            raise ValidationError('As senhas da nova conta não coincidem.')
        try:
            usuario = criar_administrador(request, **dados)
        except ErroValidacaoDjango as erro:
            raise ValidationError(getattr(erro, 'message_dict', None) or {'detail': erro.messages}) from erro
        except IntegrityError as erro:
            raise ValidationError('Já existe uma conta com estes dados.') from erro
        return Response({'detail': 'Administrador comum cadastrado. A tentativa de login solicitará confirmação de e-mail; depois, serão exigidos documentos e 2FA.', 'id': usuario.pk}, status=201)


class EncerramentosView(GestaoView):
    def get(self, request):
        if not request.user.is_superuser:
            raise PermissionDenied('Somente supremos podem analisar pedidos de encerramento administrativo.')
        pedidos = SolicitacaoEncerramentoAdmin.objects.filter(concluida_em__isnull=True).select_related('usuario')
        return paginar(request, pedidos, lambda p: {'id': p.pk, 'usuario_id': p.usuario_id, 'nome': ocultar_emails(p.usuario.username), 'motivo': p.motivo, 'criada_em': p.criada_em})



class DocumentosView(GestaoView):
    """Publicação e histórico de documentos, restritos aos supremos."""

    def get(self, request):
        if not request.user.is_superuser:
            raise PermissionDenied(
                'Somente supremos podem gerenciar os documentos legais.'
            )

        class Consulta(serializers.Serializer):
            tipo = serializers.ChoiceField(
                choices=('termos', 'privacidade'), required=False
            )
            versao = serializers.CharField(max_length=20, required=False)

        entrada = Consulta(data=request.query_params)
        entrada.is_valid(raise_exception=True)
        dados = entrada.validated_data
        tipo = dados.get('tipo')
        versao = dados.get('versao')

        if versao and not tipo:
            raise ValidationError('Informe o tipo do documento.')

        if tipo:
            from .models import PoliticaPrivacidade, TermosUso

            modelo = TermosUso if tipo == 'termos' else PoliticaPrivacidade

            if versao:
                documento = get_object_or_404(modelo, versao=versao)
                return Response(apresentar_documento(documento))

            documentos = modelo.objects.order_by('-publicada_em', '-pk')
            return paginar(request, documentos, lambda documento: {
                'versao': documento.versao,
                'publicada_em': documento.publicada_em,
            })

        return Response({
            'termos': apresentar_documento(termos_vigentes()),
            'privacidade': apresentar_documento(politica_vigente()),
        })


    def post(self, request):
        if not request.user.is_superuser:
            raise PermissionDenied('Somente supremos podem publicar documentos legais.')

        class Publicacao(serializers.Serializer):
            tipo = serializers.ChoiceField(choices=('termos', 'privacidade'))
            versao = serializers.CharField(max_length=20)
            conteudo = serializers.CharField(min_length=10, max_length=100000)
            senha_atual = serializers.CharField(max_length=1024, trim_whitespace=False)

        entrada = Publicacao(data=request.data)
        entrada.is_valid(raise_exception=True)
        dados = entrada.validated_data
        from django.db import transaction
        from .equipe import bloquear_equipe, conferir_supremo
        from .models import PoliticaPrivacidade, TermosUso
        from .cookies import limpar_cookies

        modelo = TermosUso if dados['tipo'] == 'termos' else PoliticaPrivacidade
        try:
            with transaction.atomic():
                bloquear_equipe()
                conferir_supremo(request, dados['senha_atual'])
                if modelo.objects.filter(versao=dados['versao']).exists():
                    raise ValidationError({'versao': ['Essa versão já foi publicada. Informe uma nova versão.']})
                documento = modelo.objects.create(
                    versao=dados['versao'], conteudo=dados['conteudo'],
                )
                registrar_atividade(
                    request, 'documento_publicado',
                    'termos_uso' if dados['tipo'] == 'termos' else 'politica_privacidade',
                    documento.pk, descricao='Versão publicada: ' + documento.versao,
                )
        except ErroValidacaoDjango as erro:
            raise ValidationError({'detail': erro.messages}) from erro
        except IntegrityError as erro:
            raise ValidationError({'versao': ['Essa versão já foi publicada.']}) from erro
        return limpar_cookies(Response({
            'detail': 'Nova versão publicada. Entre novamente para registrar o aceite dos documentos vigentes.',
            'tipo': dados['tipo'], 'documento': apresentar_documento(documento),
        }, status=201))



urlpatterns = [
    path('documentos/', DocumentosView.as_view()),
    path('acesso/', AcessoView.as_view()),
    path('administradores/', AdministradoresView.as_view()),
    path('encerramentos/', EncerramentosView.as_view()),
    path('contas/', ContasView.as_view()),
    path('contas/<uuid:usuario_id>/', ContaView.as_view()),
    path('tutores/', TutoresView.as_view()),
    path('tutores/<uuid:perfil_id>/', TutorView.as_view()),
    path('auditoria/opcoes/', AuditoriaOpcoesView.as_view()),
    path('auditoria/', AuditoriaView.as_view()),
]
