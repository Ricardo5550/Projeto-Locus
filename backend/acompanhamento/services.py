from django.db import transaction
from django.core.exceptions import ValidationError, PermissionDenied
from django.utils import timezone
from acompanhamento.models import (
    Convite,
    EspacoAcompanhamento,
    Participacao,
    AnotacaoCompartilhada,
    MapaCompartilhado,
)
from anotacoes.models import Anotacao
from mapas.models import MapaMental
from notificacoes.models import Notificacao

def avisar_no_canal(espaco, autor, chave, texto, *, duvida=False):
    if autor.pk == espaco.proprietario_id:
        destinatarios = Participacao.objects.filter(
            espaco=espaco, ativo=True, saiu_em__isnull=True,
            tutor__ativo=True, tutor__usuario__is_active=True,
        ).exclude(tutor__usuario=autor).values_list('tutor__usuario_id', flat=True).distinct()
    else:
        destinatarios = [espaco.proprietario_id]

    for destinatario_id in destinatarios:
        Notificacao.all_objects.get_or_create(
            destinatario_id=destinatario_id,
            chave=f'acompanhamento:{chave}',
            defaults={
                'tipo': 'acompanhamento',
                'texto': texto,
                'destino': 'acompanhamento-duvidas' if duvida else 'acompanhamento',
                'recurso_id': espaco.pk,
            },
        )


@transaction.atomic
def criar_convite(espaco, tutor, usuario):
    if not usuario.is_authenticated or not usuario.is_active:
        raise PermissionDenied("Usuário não autorizado.")

    if usuario != espaco.proprietario:
        raise PermissionDenied("Somente o proprietário pode convidar um tutor.")

    if not tutor.ativo or not tutor.usuario.is_active:
        raise ValidationError("Este tutor está inativo.")

    if tutor.usuario_id == usuario.pk:
        raise ValidationError("Você não pode convidar a si mesmo.")

    # Criação e aceite usam o mesmo bloqueio antes de verificar duplicatas.
    EspacoAcompanhamento.objects.select_for_update().get(pk=espaco.pk)

    if Participacao.objects.filter(
        espaco=espaco,
        tutor=tutor,
        ativo=True
    ).exists():
        raise ValidationError("Este tutor já participa do canal.")

    if Convite.objects.filter(
        espaco=espaco,
        tutor=tutor,
        status='pendente'
    ).exists():
        raise ValidationError("Já existe um convite pendente para este tutor.")

    return Convite.objects.create(
        espaco=espaco,
        tutor=tutor,
        solicitado_por=usuario,
        status='pendente'
    )

@transaction.atomic
def aceitar_convite(convite, usuario):
    EspacoAcompanhamento.objects.select_for_update().get(pk=convite.espaco_id)
    convite = Convite.objects.select_for_update().get(pk=convite.pk)

    if convite.status != 'pendente':
        raise ValidationError("Convite não está pendente.")

    proprietario = convite.espaco.proprietario
    usuario_tutor = convite.tutor.usuario
    solicitante = convite.solicitado_por

    if not proprietario.is_active or not usuario_tutor.is_active or not convite.tutor.ativo:
        raise ValidationError("O proprietário ou o tutor está inativo.")

    if proprietario == usuario_tutor:
        raise ValidationError("O usuário não pode ser tutor de si mesmo.")

    if solicitante == proprietario:
        destinatario = usuario_tutor
    elif solicitante == usuario_tutor:
        destinatario = proprietario
    else:
        raise ValidationError("O solicitante do convite é inválido.")

    if not usuario.is_authenticated or not usuario.is_active or usuario != destinatario:
        raise PermissionDenied("Você não tem permissão para aceitar este convite.")

    if Participacao.objects.filter(espaco=convite.espaco, tutor=convite.tutor, ativo=True).exists():
        raise ValidationError("O tutor já está participando deste canal.")

    Participacao.objects.create(
        espaco=convite.espaco,
        tutor=convite.tutor,
        ativo=True,
    )

    convite.status = 'aceito'
    convite.respondido_em = timezone.now()
    convite.save(update_fields=['status', 'respondido_em'])

@transaction.atomic
def recusar_convite(convite, usuario):
    if not usuario.is_authenticated or not usuario.is_active:
        raise PermissionDenied("Usuário não autorizado.")

    convite = Convite.objects.select_for_update().get(
        pk=convite.pk
    )

    proprietario = convite.espaco.proprietario
    usuario_tutor = convite.tutor.usuario
    solicitante = convite.solicitado_por

    if solicitante == proprietario:
        destinatario = usuario_tutor
    elif solicitante == usuario_tutor:
        destinatario = proprietario
    else:
        raise ValidationError("O solicitante do convite é inválido.")

    if usuario != destinatario:
        raise PermissionDenied("Você não tem permissão para recusar este convite.")

    if convite.status != 'pendente':
        raise ValidationError("Este convite não está pendente.")

    convite.status = 'recusado'
    convite.respondido_em = timezone.now()
    convite.save(update_fields=['status', 'respondido_em'])

    return convite

@transaction.atomic
def remover_tutor(espaco, tutor, usuario):
    if not usuario.is_authenticated or not usuario.is_active or usuario != espaco.proprietario:
        raise PermissionDenied("Você não tem permissão para remover este tutor.")

    EspacoAcompanhamento.objects.select_for_update().get(pk=espaco.pk)
    participacao = Participacao.objects.select_for_update().filter(
        espaco=espaco,
        tutor=tutor,
        ativo=True
    ).first()

    if participacao is None:
        raise ValidationError("Este tutor não possui participação ativa neste canal.")

    participacao.ativo = False
    participacao.saiu_em = timezone.now()
    participacao.save(update_fields=['ativo', 'saiu_em'])

@transaction.atomic
def compartilhar_anotacao(espaco, anotacao, usuario):
    if not usuario.is_authenticated or not usuario.is_active or usuario != espaco.proprietario:
        raise PermissionDenied("Você não tem permissão para compartilhar esta anotação.")

    if anotacao.autor_id != usuario.pk:
        raise PermissionDenied("Você não pode compartilhar uma anotação que não é sua.")

    if not Anotacao.objects.filter(
        pk=anotacao.pk,
        autor=usuario,
        deletado_em__isnull=True
    ).exists():
        raise ValidationError("A anotação não existe ou foi excluída.")

    compartilhamento, criado = AnotacaoCompartilhada.objects.get_or_create(
        espaco=espaco,
        anotacao=anotacao
    )

    if criado:
        avisar_no_canal(espaco, usuario, f'anotacao:{compartilhamento.pk}', 'Nova anotação compartilhada no canal.')
    return compartilhamento

@transaction.atomic
def compartilhar_mapa(espaco, mapa, usuario):
    if not usuario.is_authenticated or not usuario.is_active or usuario != espaco.proprietario:
        raise PermissionDenied("Você não tem permissão para compartilhar este mapa.")

    if mapa.autor_id != usuario.pk:
        raise PermissionDenied("Você não pode compartilhar um mapa que não é seu.")

    if not MapaMental.objects.filter(
        pk=mapa.pk,
        autor=usuario,
        deletado_em__isnull=True
    ).exists():
        raise ValidationError("O mapa não existe ou foi excluído.")

    compartilhamento, criado = MapaCompartilhado.objects.get_or_create(
        espaco=espaco,
        mapa=mapa
    )

    if criado:
        avisar_no_canal(espaco, usuario, f'mapa:{compartilhamento.pk}', 'Novo mapa mental compartilhado no canal.')
    return compartilhamento

def pode_visualizar_anotacao(anotacao, usuario):
    if not usuario.is_authenticated or not usuario.is_active:
        return False

    if not Anotacao.objects.filter(
        pk=anotacao.pk,
        deletado_em__isnull=True
    ).exists():
        return False

    if anotacao.autor_id == usuario.pk:
        return True

    return AnotacaoCompartilhada.objects.filter(
        anotacao=anotacao,
        espaco__proprietario__is_active=True,
        espaco__participacao__tutor__usuario=usuario,
        espaco__participacao__tutor__ativo=True,
        espaco__participacao__ativo=True,
        espaco__participacao__saiu_em__isnull=True
    ).exists()

def pode_visualizar_mapa(mapa, usuario):
    if not usuario.is_authenticated or not usuario.is_active:
        return False

    if not MapaMental.objects.filter(
        pk=mapa.pk,
        deletado_em__isnull=True
    ).exists():
        return False

    if mapa.autor_id == usuario.pk:
        return True

    return MapaCompartilhado.objects.filter(
        mapa=mapa,
        espaco__proprietario__is_active=True,
        espaco__participacao__tutor__usuario=usuario,
        espaco__participacao__tutor__ativo=True,
        espaco__participacao__ativo=True,
        espaco__participacao__saiu_em__isnull=True
    ).exists()
