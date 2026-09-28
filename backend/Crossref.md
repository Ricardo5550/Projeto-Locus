# Integração com a API Crossref

## Objetivo

O Locus utiliza a API pública da Crossref para pesquisar referências
acadêmicas relacionadas aos conteúdos de estudo do usuário.

## API externa

Serviço: Crossref REST API

Endpoint utilizado:

https://api.crossref.org/works

Método HTTP:

GET

A consulta bibliográfica é enviada pelo parâmetro:

query.bibliographic

São solicitados até 8 resultados por pesquisa.

## Endpoint interno do Locus

GET /api/referencias/?q=termo

O endpoint exige autenticação JWT.

O parâmetro `q` deve possuir entre 2 e 200 caracteres.

## Fluxo

Frontend
→ API do Locus
→ serviço de referências
→ Crossref
→ normalização dos resultados
→ Frontend

A chamada à Crossref é realizada exclusivamente pelo Back-End.

## Dados retornados

Os resultados são normalizados para:

- título;
- autores;
- ano;
- publicação;
- DOI;
- URL;
- tipo da publicação.

## Timeout e cache

A chamada externa possui timeout de 8 segundos.

Resultados de uma mesma pesquisa são armazenados em cache por
600 segundos para reduzir chamadas repetidas à API externa.

## Tratamento de erros

HTTP 400:
termo de pesquisa inválido.

HTTP 401:
usuário não autenticado.

HTTP 503:
falha ou indisponibilidade da API Crossref.

A indisponibilidade da API externa não interrompe as demais
funcionalidades do Locus.

## Privacidade

Somente o termo necessário à pesquisa é enviado à Crossref.

Essa integração é informada ao usuário na Política de Privacidade.