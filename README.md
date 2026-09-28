# Projeto Locus

O **Locus** é uma plataforma web para criação, organização e revisão de conteúdos de estudo por meio de anotações, mapas mentais interativos e questionários de revisão.

A aplicação permite criar e editar anotações formatadas, construir mapas mentais com blocos e conexões, relacionar conteúdos, gerar perguntas de revisão e consultar referências acadêmicas por meio da API Crossref.

## Funcionalidades principais

- Cadastro e autenticação de usuários;
- confirmação obrigatória de e-mail;
- recuperação e redefinição de senha por e-mail;
- proteção do login com Google reCAPTCHA;
- autenticação por JWT;
- controle de acesso para que cada usuário visualize apenas os próprios conteúdos;
- criação e edição de anotações com Tiptap;
- criação de mapas mentais interativos com React Flow;
- criação de perguntas e tentativas de revisão;
- integração com a API Crossref para busca de referências acadêmicas;
- registro de ações em logs de auditoria;
- Termos de Uso e Política de Privacidade acessíveis pelo sistema;
- registro de aceite dos Termos e ciência da Política de Privacidade;
- criptografia em repouso de conteúdos sensíveis;
- exclusão lógica (soft-delete) de conteúdos da aplicação.

## Arquitetura

O Back-End é organizado como um **monólito modular**, com os principais domínios separados em aplicações Django:

```text
backend/
├── anotacoes/
├── auditoria/
├── core/
├── locus/
├── mapas/
├── referencias/
├── revisoes/
└── usuarios/
```

O diretório `core` concentra apenas recursos compartilhados de infraestrutura, como campos e funções de criptografia.

## Tecnologias

### Front-End

- **React - 19.2.8:** construção da interface por meio de componentes reutilizáveis;
- **TypeScript - 6.0.3:** tipagem e organização do código;
- **Node.js - 24.21.0:** ambiente utilizado pelas ferramentas do Front-End;
- **Vite - 8.2.2:** servidor e ferramenta de build do Front-End;
- **Tiptap - 3.31.3:** editor de anotações com conteúdo estruturado;
- **React Flow - 12.11.6:** criação e manipulação dos mapas mentais;
- **Lucide React - 1.45.0:** biblioteca de ícones;
- **CSS:** estilização da interface.

### Back-End

- **Python - 3.11:** linguagem utilizada no servidor;
- **Django - 5.2.17:** framework principal do Back-End;
- **Django REST Framework - 3.18.1:** criação da API REST;
- **dj-rest-auth:** endpoints de autenticação, recuperação de senha e integração com o fluxo de registro;
- **django-allauth:** cadastro, confirmação de e-mail e gerenciamento de endereços de e-mail;
- **Simple JWT:** autenticação por access token e refresh token;
- **django-cors-headers - 4.9.0:** configuração de CORS;
- **psycopg2-binary - 2.9.12:** integração com PostgreSQL;
- **python-dotenv - 1.2.3:** carregamento das variáveis de ambiente;
- **cryptography:** criptografia de campos sensíveis utilizando Fernet.

### Banco de Dados

- **PostgreSQL:** persistência dos dados da aplicação.

Cada anotação e cada mapa mental principal são armazenados como registros próprios. As anotações utilizam conteúdo estruturado em JSON e os mapas mentais armazenam blocos, posições, propriedades, conexões e visualizações internas.

## Segurança e controle de acesso

O Locus utiliza autenticação JWT. O access token possui validade curta e o refresh token é utilizado para renovação da sessão.

As APIs protegidas exigem autenticação, e os dados são filtrados pelo usuário autenticado para impedir que uma conta consulte ou altere conteúdos pertencentes a outra.

As senhas não são armazenadas de forma reversível: o Django utiliza hash seguro para proteção das credenciais.

Conteúdos sensíveis armazenados no banco utilizam criptografia Fernet. A chave de criptografia é mantida em variável de ambiente e não deve ser versionada no repositório.

O login também utiliza Google reCAPTCHA, cuja validação é realizada pelo Back-End.

## Auditoria

O sistema registra ações relevantes para permitir rastreabilidade, incluindo operações como:

- login e logout;
- criação, edição e exclusão de conteúdos;
- criação e alteração de perguntas;
- registro de tentativas de revisão.

Os registros de auditoria podem ser consultados por usuários administrativos pelo Django Admin.

## Integração com a Crossref

O Locus utiliza a API pública da **Crossref** para localizar referências acadêmicas relacionadas ao conteúdo pesquisado pelo usuário.

Endpoint interno:

```text
GET /api/referencias/?q=termo
```

A integração:

- utiliza o endpoint `/works` da Crossref;
- envia a consulta bibliográfica pelo parâmetro `query.bibliographic`;
- limita a quantidade de resultados retornados;
- normaliza título, autores, ano, publicação, DOI, URL e tipo;
- utiliza timeout para chamadas externas;
- utiliza cache temporário;
- trata indisponibilidade da API sem interromper a aplicação.

## LGPD e privacidade

O sistema disponibiliza **Termos de Uso** e **Política de Privacidade** diretamente pela interface.

Durante o cadastro, o usuário deve:

- aceitar os Termos de Uso;
- declarar ciência da Política de Privacidade.

O sistema registra a manifestação do usuário, incluindo versão do documento, data e hora e demais informações utilizadas para rastreabilidade.

A Política de Privacidade descreve os dados efetivamente tratados pelo Locus, suas finalidades, serviços externos utilizados, medidas de segurança, retenção e direitos dos titulares.

O contato para assuntos relacionados a privacidade e proteção de dados é disponibilizado na própria Política de Privacidade.

## Como executar

### Pré-requisitos

- Python 3.11;
- PostgreSQL;
- Node.js e npm;
- Git.

### Banco de Dados

Com o PostgreSQL em execução, crie um banco de dados para a aplicação. Exemplo:

```text
locus
```

### Back-End

Acesse a pasta:

```bash
cd backend
```

Crie e ative um ambiente virtual.

Windows:

```bash
python -m venv .venv
.venv\Scripts\activate
```

Instale as dependências:

```bash
pip install -r requirements.txt
```

Crie o arquivo:

```text
backend/.env
```

Exemplo de configuração local:

```env
DB_NAME=locus
DB_USER=postgres
DB_PASSWORD=sua_senha
DB_HOST=localhost

DEBUG=True

RECAPTCHA_SECRET_KEY=sua_chave_secreta_recaptcha
DATA_ENCRYPTION_KEY=sua_chave_fernet

EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=seu_email@gmail.com
EMAIL_HOST_PASSWORD=sua_senha_de_app
DEFAULT_FROM_EMAIL="Locus <seu_email@gmail.com>"

FRONTEND_URL=http://localhost:5173
CROSSREF_EMAIL=seu_email@example.com
```


Para gerar uma chave Fernet:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Aplique as migrações:

```bash
python manage.py migrate
```

Valide a configuração:

```bash
python manage.py check
```

Inicie o servidor:

```bash
python manage.py runserver
```

O Back-End ficará disponível em:

```text
http://127.0.0.1:8000/
```

A API utiliza como endereço base:

```text
http://127.0.0.1:8000/api/
```

### Front-End

Em outro terminal:

```bash
cd frontend
```

Instale as dependências:

```bash
npm install
```

Crie o arquivo:

```text
frontend/.env
```

Exemplo:

```env
VITE_API_URL=http://127.0.0.1:8000/api
VITE_RECAPTCHA_SITE_KEY=sua_chave_publica_recaptcha
```

Inicie o Vite:

```bash
npm run dev
```

O endereço local normalmente será:

```text
http://localhost:5173/
```
