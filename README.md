# denisplace

Sistema de gestão de contratos e cobrança para locação de câmeras de segurança e portaria eletrônica.

O projeto centraliza cadastros, contratos, orçamentos e contas a receber, substituindo controles em planilhas por um fluxo auditável de cobrança, pagamento e inadimplência.

## Funcionalidades

- Cadastro de clientes, condomínios, unidades, catálogo, equipamentos e índices de reajuste.
- Gestão de contratos, itens versionados, aditivos, vigência e aderência por unidade.
- Orçamentos com conversão de itens recorrentes em contratos.
- Geração mensal de faturas e títulos para contratos vigentes.
- Contas a receber com controle manual de boleto, nota fiscal, pagamento, multa e juros.
- Dashboard financeiro e matriz de inadimplência.
- Login com perfis de administrador, comercial, financeiro e técnico.
- Trilha de auditoria para alterações relevantes.
- Importação de dados por planilha/CSV e exportação de contas a receber.
- Worker para tarefas assíncronas com BullMQ e Redis.
- Backup e restauração do PostgreSQL por scripts.

> O sistema não possui integração bancária. Emissão de boleto, emissão de nota fiscal e baixa de pagamento são registrados manualmente pelo usuário.

## Tecnologias

- Node.js 22+
- Next.js 15, React 19 e TypeScript
- PostgreSQL 16
- Prisma 6
- Redis 7 e BullMQ
- Tailwind CSS
- Vitest

## Pré-requisitos

- Node.js 22 ou superior
- npm
- Docker e Docker Compose, para subir PostgreSQL e Redis localmente

## Configuração local

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Crie o arquivo de ambiente:

   ```bash
   cp .env.example .env
   ```

3. Inicie os serviços de infraestrutura:

   ```bash
   docker compose up -d db redis
   ```

4. Gere o cliente Prisma e aplique as migrações:

   ```bash
   npm run prisma:generate
   npm run prisma:deploy
   ```

   Para desenvolvimento, quando houver novas migrações:

   ```bash
   npm run prisma:migrate
   ```

5. Popule os dados iniciais, se necessário:

   ```bash
   npm run db:seed
   ```

6. Inicie a aplicação:

   ```bash
   npm run dev
   ```

   Acesse `http://localhost:3000`.

O `.env.example` já está configurado para as portas locais específicas do projeto: PostgreSQL em `5434` e Redis em `6390`. Ajuste `AUTH_SECRET` antes de usar autenticação.

## Execução completa com Docker

Para construir e iniciar aplicação, worker, PostgreSQL e Redis:

```bash
cp .env.example .env
docker compose --profile full up --build
```

A aplicação ficará disponível em `http://localhost:3101`. O perfil de backup pode ser iniciado separadamente:

```bash
docker compose --profile ops up -d backup
```

## Principais comandos

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia o servidor de desenvolvimento |
| `npm run build` | Gera a build de produção |
| `npm run start` | Inicia a aplicação em produção |
| `npm run typecheck` | Executa a verificação de tipos |
| `npm run test` | Executa os testes |
| `npm run worker:dev` | Inicia o worker em modo de desenvolvimento |
| `npm run build:worker` | Compila o worker para produção |
| `npm run prisma:studio` | Abre o Prisma Studio |
| `npm run prisma:migrate` | Cria/aplica migrações em desenvolvimento |
| `npm run prisma:deploy` | Aplica migrações existentes |
| `npm run db:seed` | Executa o seed do banco |
| `npm run db:backup` | Cria backup do banco |
| `npm run db:restore` | Restaura um backup |
| `npm run cobranca:gerar` | Gera a cobrança mensal |
| `npm run import:planilha` | Importa dados de planilha |

## Estrutura do projeto

```text
src/
  app/                 Páginas, rotas e Server Actions do Next.js
  auth/                Autenticação, perfis e guards de acesso
  domain/              Regras de negócio e cálculos de cobrança
  lib/                 Utilitários compartilhados
  server/              Persistência, auditoria, importação, relatórios e jobs
  ui/                  Componentes de interface
prisma/
  schema.prisma        Modelo de dados
  migrations/          Migrações do PostgreSQL
  seed.ts              Dados iniciais
importacao/            Templates CSV para importação
scripts/               Backup, restauração e build do worker
```

## Modelo de cobrança

O fluxo financeiro é separado em quatro camadas:

`Contrato → Fatura → Título → Pagamento`

Valores monetários são armazenados como `Decimal`, e competência e vencimento usam datas sem horário para evitar problemas de fuso. Reajustes criam novas versões dos itens e aditivos, preservando o histórico.

## Importação

Os templates de referência estão em [`importacao/`](importacao/):

- `template-contratos.csv`
- `template-cobrancas.csv`

Antes de importar dados reais, faça um backup do banco e valide o relatório de rejeições gerado pelo processo.

## Testes e qualidade

Execute os testes e a verificação de tipos antes de enviar alterações:

```bash
npm run test
npm run typecheck
```

## Escopo atual

O núcleo atual prioriza a operação comercial e de cobrança. Integração bancária, contas a pagar, estoque, compras, ordens de serviço, portal do morador e cobrança automática permanecem previstos para fases futuras. O detalhamento está em [`escopo-sistema-fases.md`](escopo-sistema-fases.md).

## Segurança e configuração

- Nunca versione o arquivo `.env` nem credenciais reais.
- Use um `AUTH_SECRET` com pelo menos 32 caracteres.
- Em produção, forneça os segredos por variáveis de ambiente.
- Configure armazenamento S3 compatível quando os comprovantes não forem mantidos em disco local.
