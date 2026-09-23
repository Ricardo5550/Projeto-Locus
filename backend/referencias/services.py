"""Consulta metadados bibliográficos públicos na API Crossref."""

import json
import os
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


CROSSREF_URL = 'https://api.crossref.org/works'


class CrossrefIndisponivel(Exception):
    """A API externa não respondeu com dados utilizáveis."""


def _primeiro_texto(valor):
    if isinstance(valor, list) and valor and isinstance(valor[0], str):
        return valor[0]
    return ''


def _ano_publicacao(item):
    for chave in ('published', 'issued', 'created'):
        partes = (item.get(chave) or {}).get('date-parts') or []
        if partes and partes[0] and isinstance(partes[0][0], int):
            return partes[0][0]
    return None


def _normalizar(item):
    autores = []
    for autor in item.get('author') or []:
        nome = ' '.join(parte for parte in (autor.get('given'), autor.get('family')) if parte)
        if nome:
            autores.append(nome)
    doi = item.get('DOI') or ''
    return {
        'titulo': _primeiro_texto(item.get('title')),
        'autores': autores,
        'ano': _ano_publicacao(item),
        'publicacao': _primeiro_texto(item.get('container-title')),
        'doi': doi,
        'url': item.get('URL') or (f'https://doi.org/{doi}' if doi else ''),
        'tipo': item.get('type') or '',
    }


def pesquisar_crossref(termo):
    """Retorna até oito obras em formato simplificado para a interface do Locus."""
    email = os.getenv('CROSSREF_EMAIL', '').strip()
    parametros = {'query.bibliographic': termo, 'rows': 8}
    if email:
        parametros['mailto'] = email
    url = f'{CROSSREF_URL}?{urlencode(parametros)}'
    agente = f'Locus/1.0 (mailto:{email})' if email else 'Locus/1.0'
    requisicao = Request(url, headers={
        'User-Agent': agente,
        'Accept': 'application/json',
    })

    try:
        with urlopen(requisicao, timeout=8) as resposta:
            payload = json.load(resposta)
        itens = payload['message']['items']
        if not isinstance(itens, list):
            raise ValueError('Resposta sem lista de obras')
        return [_normalizar(item) for item in itens if isinstance(item, dict)]
    except (HTTPError, URLError, TimeoutError, ValueError, KeyError, TypeError, UnicodeError) as exc:
        raise CrossrefIndisponivel('Não foi possível consultar a Crossref.') from exc
