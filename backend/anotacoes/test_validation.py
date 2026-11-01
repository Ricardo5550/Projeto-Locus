from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient


def document(text='Texto de estudo'):
    return {'type': 'doc', 'content': [{'type': 'paragraph', 'content': [{'type': 'text', 'text': text}]}]}


class DocumentValidationTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = get_user_model().objects.create_user('notas', 'notes@example.test', 'SenhaTeste123!')
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def save(self, content):
        return self.client.post('/api/anotacoes/', {'titulo': 'Estudo', 'conteudo': content}, format='json')

    def test_aceita_texto_com_marcacao_como_texto_e_normaliza_vazio(self):
        for content in ({}, document('<script>alert(1)</script>')):
            with self.subTest(content=content):
                response = self.save(content)
                self.assertEqual(response.status_code, 201, response.data)
                self.assertEqual(response.data['conteudo']['type'], 'doc')

    def test_preserva_formatacao_do_editor_e_imagem(self):
        content = document()
        paragraph = content['content'][0]
        paragraph['attrs'] = {'textAlign': 'center'}
        paragraph['content'][0]['marks'] = [
            {'type': 'bold'}, {'type': 'underline'},
            {'type': 'textStyle', 'attrs': {'fontFamily': 'Arial', 'color': 'rgb(255, 0, 0)'}},
            {'type': 'link', 'attrs': {'href': 'https://example.test/artigo', 'target': '_blank', 'rel': 'opener', 'class': None}},
        ]
        content['content'] += [
            {'type': 'heading', 'attrs': {'level': 2, 'textAlign': None}, 'content': [{'type': 'text', 'text': 'Título'}]},
            {'type': 'bulletList', 'content': [{'type': 'listItem', 'content': [{'type': 'paragraph'}]}]},
            {'type': 'image', 'attrs': {'src': 'data:image/png;base64,iVBORw0KGgo=', 'alt': None, 'title': None, 'width': None, 'height': None}},
        ]
        response = self.save(content)
        self.assertEqual(response.status_code, 201, response.data)
        mark = response.data['conteudo']['content'][0]['content'][0]['marks'][-1]
        self.assertEqual(mark['attrs']['rel'], 'noopener noreferrer nofollow')

    def test_recusa_html_texto_solto_e_estrutura_invalida(self):
        for content in ('<img src=x onerror=alert(1)>', [], {'foo': 'bar'}, {'type': 'doc', 'content': 'invalido'}):
            with self.subTest(content=content):
                self.assertEqual(self.save(content).status_code, 400)

    def test_recusa_elementos_e_atributos_desconhecidos(self):
        for node in ({'type': 'script', 'text': 'alert(1)'},
                     {'type': 'paragraph', 'attrs': {'onclick': 'alert(1)'}},
                     {'type': 'paragraph', 'dangerouslySetInnerHTML': {'__html': 'x'}},
                     {'type': 'paragraph', 'content': [{'type': 'text', 'text': 'x', 'marks': [{'type': 'unknown'}]}]}):
            with self.subTest(node=node):
                self.assertEqual(self.save({'type': 'doc', 'content': [node]}).status_code, 400)

    def test_recusa_urls_ativas_e_css_arbitrario(self):
        for href in ('javascript:alert(1)', 'data:text/html,oi', 'vbscript:msgbox(1)', 'java\nscript:alert(1)', '//example.test'):
            content = document()
            content['content'][0]['content'][0]['marks'] = [{'type': 'link', 'attrs': {'href': href}}]
            with self.subTest(href=href):
                self.assertEqual(self.save(content).status_code, 400)
        content = document()
        content['content'][0]['content'][0]['marks'] = [{'type': 'textStyle', 'attrs': {'color': 'url(javascript:alert(1))'}}]
        self.assertEqual(self.save(content).status_code, 400)

    def test_recusa_svg_base64_invalido_e_tipo_disfarcado(self):
        for src in ('data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,aaaa', 'javascript:alert(1)'):
            with self.subTest(src=src):
                self.assertEqual(self.save({'type': 'doc', 'content': [{'type': 'image', 'attrs': {'src': src}}]}).status_code, 400)

    def test_limites_de_documento(self):
        deep = {'type': 'paragraph'}
        for _ in range(25):
            deep = {'type': 'blockquote', 'content': [deep]}
        cases = [
            {'type': 'doc', 'content': [deep]},
            {'type': 'doc', 'content': [{'type': 'paragraph'}] * 10001},
            {'type': 'doc', 'content': [{'type': 'paragraph', 'content': [{'type': 'text', 'text': 'a'*200000}]}] * 27},
        ]
        for content in cases:
            with self.subTest(size=len(str(content))):
                self.assertEqual(self.save(content).status_code, 400)

    def test_edicao_invalida_nao_substitui_conteudo_salvo(self):
        response = self.save(document('Original'))
        path = f"/api/anotacoes/{response.data['id']}/"
        result = self.client.patch(path, {'conteudo': '<script>alert(1)</script>'}, format='json')
        self.assertEqual(result.status_code, 400)
        self.assertEqual(self.client.get(path).data['conteudo'], document('Original'))

    def test_usuario_nao_pode_alterar_nota_alheia(self):
        response = self.save(document())
        other = get_user_model().objects.create_user('outro', 'other@example.test', 'SenhaTeste123!')
        self.client.force_authenticate(other)
        path = f"/api/anotacoes/{response.data['id']}/"
        self.assertEqual(self.client.patch(path, {'conteudo': document('Alterado')}, format='json').status_code, 404)
