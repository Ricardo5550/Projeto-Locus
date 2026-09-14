# Projeto Locus
 
O **Locus** é uma plataforma web para criação e organização de conteúdos de estudo por meio de anotações e mapas mentais interativos.
 
A aplicação permite criar, editar e armazenar anotações formatadas, além de construir mapas mentais com elementos personalizáveis, conexões e navegação entre conteúdos.

- [Como executar](#Como-executar)
 
## Tecnologias
 
### Front-End
 
- **React - 19.2.8:** utilizado na construção da interface da aplicação por meio de componentes reutilizáveis.
- **TypeScript - 6.0.3:** utilizado na tipagem do Front-End, auxiliando na organização, identificação de erros e manutenção do código.
- **Node.js - 24.21.0:** utilizado como ambiente de execução para as ferramentas do Front-End e para o gerenciamento das dependências via npm.
- **Vite - 8.2.2:** utilizado como ferramenta de desenvolvimento e execução do Front-End.
- **Tiptap - 3.31.3:** utilizado na implementação do editor de anotações e na representação de conteúdos de texto estruturados e formatados.
- **React Flow - 12.11.6:** utilizado na criação e manipulação dos blocos, posições e conexões dos mapas mentais.
- **Lucide React - 1.45.0:** utilizado para os ícones presentes na interface.
- **CSS:** utilizado na estilização e organização visual da aplicação.
 
### Back-End
 
- **Python - 3.11:** linguagem utilizada no desenvolvimento do Back-End.
- **Django - 5.2.17:** framework responsável pela estrutura do servidor, definição dos modelos e acesso aos dados da aplicação.
- **Django REST Framework - 3.18.1:** utilizado na criação da API REST responsável pela comunicação entre o Front-End e o Back-End.
- **django-cors-headers - 4.9.0:** utilizado para configurar o CORS, permitindo requisições do Front-End para a API em origens diferentes durante o desenvolvimento.
- **psycopg2-binary - 2.9.12:** utilizado na comunicação entre Django e PostgreSQL.
- **python-dotenv - 1.2.3:** utilizado para carregar configurações do ambiente, como as credenciais de acesso ao banco de dados.
 
### Banco de Dados
 
- **PostgreSQL:** utilizado para persistência dos dados da aplicação.
 
Cada anotação e cada mapa mental principal são armazenados como registros próprios no banco de dados. As anotações utilizam um campo JSON para armazenar o conteúdo estruturado do editor, enquanto os mapas mentais utilizam um campo JSON para armazenar blocos, posições, propriedades, conexões e visualizações internas.
 
## Como executar
 
### Pré-requisitos
 
- Python 3.11;
- PostgreSQL;
- Node.js e npm;
- Git.
 
### Banco de Dados
 
Com o PostgreSQL em execução, crie um banco de dados para a aplicação. Por exemplo:
 
```text
locus
```
 
Dentro da pasta /backend, crie um arquivo .env com as informações de conexão:
 
```env
DB_NAME=locus
DB_USER=postgres
DB_PASSWORD=sua_senha
DB_HOST=localhost
```
 
O valor de DB_PASSWORD é o mesmo da senha configurada no PostgreSQL.
 
### Back-End
 
No terminal, acesse a pasta do Back-End:
 
```bash
cd backend
```
 
Instale as dependências:
 
```bash
pip install -r requirements.txt
```
 
Aplique as migrações necessárias ao banco de dados:
 
```bash
python manage.py migrate
```
 
Em seguida, inicie o servidor Django:
 
```bash
python manage.py runserver
```
 
Por padrão, o Back-End ficará disponível em:
 
```text
http://127.0.0.1:8000/
```
 
A API da aplicação utiliza o endereço base:
 
```text
http://127.0.0.1:8000/api/
```
 
### Front-End
 
Com o Back-End em execução, abra outro terminal e acesse a pasta do Front-End:
 
```bash
cd frontend
```
 
Instale as dependências:
 
```bash
npm install
```
 
Inicie o servidor de desenvolvimento:
 
```bash
npm run dev
```
 
O Vite exibirá no terminal o endereço local da aplicação, normalmente:
 
```text
http://localhost:5173/
```
 
Acesse esse endereço pelo navegador para utilizar o Locus.
