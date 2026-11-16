from hashlib import sha256

from .models import AceiteLegal, PoliticaPrivacidade, TermosUso


def obter_ip_cliente(request):
    from core.ip import obter_ip_cliente as obter_ip_confiavel

    return obter_ip_confiavel(request)


def politica_vigente():
    return PoliticaPrivacidade.objects.latest('publicada_em', 'pk')


def termos_vigentes():
    return TermosUso.objects.latest('publicada_em', 'pk')


def apresentar_documento(documento):
    return {
        'versao': documento.versao,
        'conteudo': documento.conteudo,
        'publicada_em': documento.publicada_em,
    }


def documentos_vigentes(politica=None, termos=None):
    politica = politica if politica is not None else politica_vigente()
    termos = termos if termos is not None else termos_vigentes()
    texto_termos = '\n'.join(
        linha.removeprefix('## ') for linha in termos.conteudo.split('\n')
    )
    texto_termos = f'Termos de Uso\nVersão {termos.versao}\n\n{texto_termos}'
    hash_termos = sha256(texto_termos.encode('utf-8')).hexdigest()
    hash_politica = sha256(politica.conteudo.encode('utf-8')).hexdigest()

    return (
        (
            AceiteLegal.TipoDocumento.TERMOS,
            AceiteLegal.TipoManifestacao.ACEITE,
            termos.versao,
            hash_termos,
        ),
        (
            AceiteLegal.TipoDocumento.PRIVACIDADE,
            AceiteLegal.TipoManifestacao.CIENCIA,
            politica.versao,
            hash_politica,
        ),
    )


def documentos_atualizados(usuario, documentos=None):
    registrados = set(
        usuario.aceites_legais.values_list(
            'tipo_documento',
            'tipo_manifestacao',
            'versao',
            'hash_documento',
        )
    )
    if documentos is None:
        documentos = documentos_vigentes()
    return all(documento in registrados for documento in documentos)


def registrar_documentos(request, usuario, documentos=None):
    if documentos is None:
        documentos = documentos_vigentes()
    for tipo, manifestacao, versao, hash_documento in documentos:
        AceiteLegal.objects.get_or_create(
            usuario=usuario,
            tipo_documento=tipo,
            versao=versao,
            defaults={
                'tipo_manifestacao': manifestacao,
                'hash_documento': hash_documento,
                'endereco_ip': obter_ip_cliente(request),
                'user_agent': request.META.get('HTTP_USER_AGENT', '')[:500],
            },
        )
