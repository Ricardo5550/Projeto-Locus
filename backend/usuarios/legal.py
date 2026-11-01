TERMOS_VERSAO = '1.0'
TERMOS_HASH_SHA256 = 'd86401d7bf2924bcbf3a1fb93e764bc17d819bcdddbf6e193102bb8538088441'

PRIVACIDADE_VERSAO = '1.0'
PRIVACIDADE_HASH_SHA256 = 'af9710b513e1f620b9a5e4f7e479b67a9e1119a17b9899f89b98cb8b925b4ba5'


def obter_ip_cliente(request):
    from core.ip import obter_ip_cliente as obter_ip_confiavel
    return obter_ip_confiavel(request)
