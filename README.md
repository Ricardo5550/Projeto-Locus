# Projeto Locus

O **Locus** é uma plataforma web para criação, organização e revisão de conteúdos de estudo. A aplicação reúne anotações formatadas, mapas mentais interativos, questionários com repetição espaçada e acompanhamento por tutores.

- [Como executar](#como-executar)

## Funcionalidades

- **Biblioteca:** organização de anotações e mapas mentais em pastas.
- **Anotações e mapas mentais:** edição de textos formatados, criação de blocos e conexões, vínculo entre conteúdos e busca de referências acadêmicas pela Crossref.
- **Questionários e revisões:** criação de perguntas a partir das anotações, devolutiva após finalizar a revisão e agendamento com uma adaptação do algoritmo SuperMemo SM-2.
- **Resultados:** painel com revisões para hoje, revisões atrasadas, revisões concluídas e percentual de acertos. Inclui gráficos de acertos por questionário e de evolução ao longo do tempo, com filtros por questionário e período.
- **Notificações:** avisos de revisão e de atividades nos canais de acompanhamento.
- **Tutoria:** convite e aceite de tutores, compartilhamento de anotações e mapas para leitura e troca de dúvidas e comentários. Ao abrir um mapa compartilhado, o tutor também pode consultar as anotações vinculadas aos blocos do mapa.
- **Conta e segurança:** cadastro com confirmação por e-mail, recuperação de senha, alteração de e-mail, verificação em duas etapas, exclusão de conta e registros de auditoria. Os Termos de Uso e a Política de Privacidade estão disponíveis na interface.

## Tecnologias

### Front-End

- **React 19.2.8** para a interface e seus componentes.
- **TypeScript 6.0.3** para a tipagem do código.
- **Node.js 24.21.0 e npm** para executar as ferramentas e gerenciar dependências.
- **Vite 8.2.2** para o servidor de desenvolvimento e a compilação.
- **Tiptap 3.31.3** para o editor de anotações.
- **React Flow 12.11.6** para os blocos e conexões dos mapas mentais.
- **Lucide React 1.45.0 e CSS** para ícones e estilos da interface.

### Back-End

- **Python 3.11, Django 5.2.17 e Django REST Framework 3.18.1** para o servidor e a API REST.
- **django-allauth, dj-rest-auth e Simple JWT** para cadastro, autenticação e recuperação de conta. Os tokens JWT são enviados em cookies `HttpOnly`, com proteção CSRF nas operações aplicáveis.
- **cryptography** para criptografia Fernet dos campos de conteúdo protegidos.
- **pyotp** para a verificação em duas etapas com aplicativo autenticador (TOTP).
- **django-cors-headers 4.9.0** para a configuração de CORS.
- **psycopg2-binary 2.9.12** para a conexão com o PostgreSQL.
- **python-dotenv 1.2.3** para carregar as variáveis de ambiente.

### Banco de dados

O **PostgreSQL** armazena os dados da aplicação. Cada anotação e cada mapa mental principal possui um registro próprio. Os campos de conteúdo representam em JSON o texto estruturado do editor e os blocos, posições, propriedades, conexões e visualizações internas dos mapas.

### Arquitetura

O back-end é um **monólito modular** organizado em aplicações Django, com módulos para usuários, anotações, mapas, pastas, referências, revisões, acompanhamento, notificações e auditoria. O front-end React consome a API REST.

## Como executar

### Pré-requisitos

- Python 3.11
- PostgreSQL em execução
- Node.js 24.21.0 e npm
- Git
- Chaves pública e secreta do Google reCAPTCHA v2 configuradas para o ambiente local

### Banco de dados

No PostgreSQL, crie um banco chamado `locus` e use um usuário com permissão para aplicar as migrações nesse banco. Nos exemplos abaixo, o usuário é `postgres`.

### Back-End

A partir da raiz do repositório, crie um ambiente virtual e instale as dependências. Exemplo para PowerShell:

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Crie o arquivo `backend/.env` com os dados do seu ambiente. Use a chave gerada acima em `DATA_ENCRYPTION_KEY` para um **banco novo**. Se o banco já contiver dados criptografados, use a chave original.

```dotenv
DEBUG=True
DB_NAME=locus
DB_USER=postgres
DB_PASSWORD=sua_senha_do_postgresql
DB_HOST=localhost
DB_PORT=5432

DATA_ENCRYPTION_KEY=sua_chave_fernet
RECAPTCHA_SECRET_KEY=sua_chave_secreta_recaptcha
FRONTEND_URL=http://localhost:5173
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
```

Com essa configuração local, os e-mails de confirmação, recuperação de senha e alteração de endereço são exibidos no terminal do Django. Para enviá-los por um provedor, configure o backend SMTP e preencha `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USE_TLS`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD` e `DEFAULT_FROM_EMAIL` conforme o serviço utilizado. Mantenha os arquivos `.env` fora do Git.

No mesmo terminal, aplique as migrações e inicie o Django.

```powershell
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py runserver
```

O Django ficará acessível em `http://localhost:8000/` e a API em `http://localhost:8000/api/`.

### Front-End

Crie o arquivo `frontend/.env`. Use a chave pública do mesmo reCAPTCHA configurado no back-end.

```dotenv
VITE_API_URL=http://localhost:8000/api
VITE_RECAPTCHA_SITE_KEY=sua_chave_publica_recaptcha
```

Em outro terminal, a partir da raiz do repositório, execute:

```powershell
cd frontend
npm ci
npm run dev
```

Abra `http://localhost:5173/` no navegador. Se estiver usando o e-mail no console, copie do terminal do Django o link de confirmação da conta após o cadastro.

