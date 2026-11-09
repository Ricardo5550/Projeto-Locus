"""Aceita somente o documento JSON e as opções usadas pelo editor Tiptap."""
import base64
import binascii
import json
import re
from urllib.parse import urlsplit

from rest_framework.exceptions import ValidationError

BLOCKS = {'paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList',
          'codeBlock', 'horizontalRule', 'image'}
INLINE = {'text', 'hardBreak'}
NODE_ATTRS = {
    'paragraph': {'textAlign'}, 'heading': {'level', 'textAlign'},
    'orderedList': {'start', 'type'}, 'codeBlock': {'language'},
    'image': {'src', 'alt', 'title', 'width', 'height'},
}
MARK_ATTRS = {'bold': set(), 'italic': set(), 'underline': set(),
              'strike': set(), 'code': set(),
              'textStyle': {'color', 'fontFamily'},
              'link': {'href', 'target', 'rel', 'class', 'title'}}


def fail(message):
    raise ValidationError(message)


def string(value, maximum=2000):
    if not isinstance(value, str) or len(value) > maximum:
        fail('Texto ou atributo excede o limite permitido.')


def safe_url(value, image=False):
    string(value, 2048)
    if any(ord(c) < 33 for c in value) or '\\' in value:
        fail('Endereço inválido.')
    try:
        parts = urlsplit(value)
        allowed = {'http', 'https'} if image else {'http', 'https', 'mailto'}
        if parts.scheme.lower() not in allowed:
            fail('Use somente links HTTP, HTTPS ou mailto; imagens exigem HTTP ou HTTPS.')
        if parts.scheme.lower() in {'http', 'https'} and (
                not parts.hostname or parts.username or parts.password):
            fail('Endereço inválido.')
    except ValueError:
        fail('Endereço inválido.')


def image_source(value):
    if not isinstance(value, str):
        fail('Imagem inválida.')
    if not value.startswith('data:'):
        safe_url(value, image=True)
        return
    match = re.fullmatch(r'data:image/(png|jpeg|gif|webp);base64,([A-Za-z0-9+/=]+)', value)
    if not match:
        fail('Imagem incorporada inválida. Use PNG, JPEG, GIF ou WebP; SVG não é permitido.')
    try:
        raw = base64.b64decode(match[2], validate=True)
    except (ValueError, binascii.Error):
        fail('Base64 de imagem inválido.')
    valid = {
        'png': raw.startswith(b'\x89PNG\r\n\x1a\n'),
        'jpeg': raw.startswith(b'\xff\xd8\xff'),
        'gif': raw.startswith((b'GIF87a', b'GIF89a')),
        'webp': raw.startswith(b'RIFF') and raw[8:12] == b'WEBP',
    }
    if not valid[match[1]]:
        fail('O conteúdo não corresponde ao formato da imagem.')


def attributes(kind, attrs):
    if not isinstance(attrs, dict) or set(attrs) - NODE_ATTRS.get(kind, set()):
        fail('Atributos do elemento não permitidos.')
    for key, value in attrs.items():
        if value is None:
            continue
        if key == 'textAlign':
            if value not in ('left', 'center', 'right', 'justify'):
                fail('Alinhamento inválido.')
        elif key == 'level':
            if type(value) is not int or not 1 <= value <= 6:
                fail('Nível de título inválido.')
        elif key in ('start', 'width', 'height'):
            if type(value) is not int or not 1 <= value <= 10000:
                fail('Dimensão ou início de lista inválido.')
        elif key == 'src':
            image_source(value)
        else:
            string(value)
            if key == 'type' and value not in ('1', 'a', 'A', 'i', 'I'):
                fail('Tipo de lista inválido.')


def marks(values):
    if not isinstance(values, list) or len(values) > 10:
        fail('Formatação inválida.')
    for mark in values:
        if not isinstance(mark, dict) or set(mark) - {'type', 'attrs'}:
            fail('Formatação contém campos não permitidos.')
        kind = mark.get('type')
        if not isinstance(kind, str) or kind not in MARK_ATTRS:
            fail('Tipo de formatação não permitido.')
        attrs = mark.get('attrs', {})
        if not isinstance(attrs, dict) or set(attrs) - MARK_ATTRS[kind]:
            fail('Atributos de formatação não permitidos.')
        for key, value in attrs.items():
            if value is None:
                continue
            string(value)
            if key == 'href':
                safe_url(value)
            elif key == 'fontFamily' and value.strip("\"'") not in ('Arial', 'Georgia', 'Verdana', 'Tahoma'):
                fail('Fonte não permitida.')
            elif key == 'color' and not re.fullmatch(
                    r'#[0-9a-fA-F]{3,8}|rgba?\([0-9., %]+\)', value):
                fail('Cor inválida.')
            elif key == 'target' and value not in ('_blank', '_self'):
                fail('Destino de link não permitido.')
            elif key == 'class' and value:
                fail('Classes de link não são permitidas.')
        if kind == 'link':
            safe_url(attrs.get('href', ''))
            # Não dependa do rel informado pelo cliente ao abrir nova aba.
            mark['attrs'] = {**attrs, 'rel': 'noopener noreferrer nofollow'}


def validate_document(value):
    # Compatibilidade com anotações vazias anteriores.
    if value == {}:
        return {'type': 'doc', 'content': [{'type': 'paragraph'}]}
    if not isinstance(value, dict) or value.get('type') != 'doc':
        fail('O conteúdo deve ser um documento JSON do editor, não HTML ou texto solto.')
    try:
        size = len(json.dumps(value, ensure_ascii=False, allow_nan=False).encode())
    except (ValueError, TypeError, RecursionError):
        fail('Documento inválido.')
    if size > 5 * 1024 * 1024:
        fail('A anotação excede o limite de 5 MB, incluindo imagens.')
    count = 0

    def node(item, parent=None, depth=0):
        nonlocal count
        count += 1
        if count > 10000 or depth > 24:
            fail('A anotação excede 10.000 elementos ou 24 níveis.')
        if not isinstance(item, dict) or set(item) - {'type', 'attrs', 'content', 'text', 'marks'}:
            fail('Elemento contém campos não permitidos.')
        kind = item.get('type')
        if not isinstance(kind, str) or kind not in BLOCKS | INLINE | {'doc', 'listItem'}:
            fail('Tipo de elemento não permitido.')
        allowed = (BLOCKS if parent in ('doc', 'blockquote', 'listItem') else
                   {'listItem'} if parent in ('bulletList', 'orderedList') else
                   {'text'} if parent == 'codeBlock' else
                   INLINE if parent in ('paragraph', 'heading') else {'doc'})
        if kind not in allowed:
            fail('Elemento em posição inválida no documento.')
        attributes(kind, item.get('attrs', {}))
        marks(item.get('marks', []))
        if kind == 'image':
            image_source(item.get('attrs', {}).get('src'))
        if kind == 'text':
            string(item.get('text'), 200000)
            if not item['text'] or 'content' in item:
                fail('Texto vazio ou estrutura de texto inválida.')
        elif 'text' in item:
            fail('Campo de texto em elemento inválido.')
        if kind in ('text', 'hardBreak', 'image', 'horizontalRule') and item.get('content'):
            fail('Este elemento não aceita conteúdo interno.')
        children = item.get('content', [])
        if not isinstance(children, list):
            fail('O conteúdo interno deve ser uma lista.')
        for child in children:
            node(child, kind, depth + 1)

    node(value)
    return value
