# 🐾 Sistema de Gerenciamento para Casa de Rações

Projeto interdisciplinar de Análise e Desenvolvimento de Sistemas, desenvolvido para apoiar a rotina de uma casa de rações. A solução combina painel web, API REST, banco MySQL e aplicativo Android para atendimento de pedidos.

## Funcionalidades

**Painel web**
- Cadastro e consulta de produtos, estoque e movimentações.
- Vendas, contas a pagar e gastos por MEI.
- Gerenciamento de usuários e autenticação.
- Pedidos presenciais e entregas, com fila e acompanhamento de status.
- Consulta de indicadores operacionais e estatísticas de atendimento via API.

**Aplicativo mobile**
- Login dos funcionários.
- Cadastro, consulta e atualização dos pedidos.
- Fila de espera e histórico recente.
- Avisos locais de operações nos pedidos.

O aplicativo mobile tem escopo operacional reduzido; estoque e financeiro ficam no painel web.

## Tecnologias

- **Web e API:** React, TypeScript, Vinext/Vite, Node.js.
- **Mobile:** React Native, Expo, TypeScript, Expo Notifications.
- **Banco:** MySQL.
- **Padrões:** Factory Method para tipos de pedido e Singleton para regras de atendimento.

## Execução local

Requisitos: Node.js 22.13 ou superior, npm, MySQL e Git.

1. Instale as dependências na raiz com `npm install`.
2. Configure o MySQL e aplique `db/schema_mysql_casa_de_racao.sql`, seguido de `db/schema_pedidos.sql`.
3. Crie um arquivo `.env` na raiz com as variáveis necessárias:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=usuario_do_banco
DB_PASSWORD=senha_do_banco
DB_NAME=casa_de_racao
AUTH_PEPPER=segredo_longo_e_aleatorio
INITIAL_ADMIN_HASH=hash_scrypt_do_administrador
```

O valor de `AUTH_PEPPER` precisa ter pelo menos 32 caracteres. `INITIAL_ADMIN_HASH` deve conter o hash scrypt usado na inicialização do primeiro administrador. Não envie o arquivo `.env` ao GitHub e não use os valores acima como credenciais reais.

4. Compile e inicie o servidor:

```bash
npm run build
npm start
```

O painel estará disponível no endereço informado pelo terminal (normalmente `http://localhost:3000`). Use `npx tsc --noEmit` para verificar os tipos.

### Aplicativo mobile

Com o backend em execução, em outro terminal:

```bash
cd mobile
npm install
npx expo install --fix
npx expo start
```

Abra o QR Code pelo Expo Go. O celular e o computador precisam estar na mesma rede para os testes locais. Na tela de login do aplicativo, informe o IP do computador e a porta do backend. **Não utilize autenticação via HTTP em redes públicas; para uso fora do ambiente de desenvolvimento, configure HTTPS.**

Consulte também [instruções específicas do aplicativo](mobile/README.md).

## API, estrutura e documentação

A autenticação web é feita por sessão em cookie; o aplicativo utiliza token de sessão. A API de pedidos mantém regras de transição de status e grava os horários para cálculo dos indicadores.

- [Documentação da API de pedidos e estatísticas](docs/api-pedidos.md)
- [Estrutura SQL principal](db/schema_mysql_casa_de_racao.sql)
- [Estrutura SQL dos pedidos](db/schema_pedidos.sql)

Os controles de pedidos tratam o **atendimento**; não substituem o registro de vendas e itens do estoque.

## Arquitetura e organização

O painel web em `app/` e `components/store/` e o aplicativo em `mobile/` consomem a API REST em `app/api/`.

- **View:** componentes React e interface React Native.
- **Controller:** rotas HTTP em `app/api/`, responsáveis pela validação das entradas, autenticação e respostas.
- **Service:** `lib/services/` e `lib/orders/OrderService.ts`, responsáveis pelas operações de negócio.
- **Repository:** `lib/orders/OrderRepository.ts`, responsável pelo acesso à tabela MySQL de pedidos. Os demais serviços ainda realizam consultas SQL diretamente.
- **Model:** modelos de pedidos, tipos e validações em `lib/orders/` e nos esquemas Zod.
- **Padrões:** Factory Method para criação de pedidos e Singleton no gerenciamento de regras dos pedidos.

A organização é inspirada no MVC, com separação adicional de serviços e persistência; não equivale a um MVC clássico em todos os módulos.

## Operação e segurança

As vendas registram itens e baixas de estoque de maneira transacional. Os valores monetários são armazenados em centavos; entradas, saídas e vendas preservam o histórico. O leitor de código de barras USB pode operar como teclado com Enter, mas a compatibilidade com o equipamento real precisa ser validada.

Somente administradores gerenciam usuários. A aplicação exige a troca da senha temporária, utiliza hashes scrypt com sal e segredo do servidor e invalida sessões após logout, redefinição e troca de senha. Tokens não devem ser inseridos em documentação nem no repositório.

## Testes e conferência das estatísticas

As estatísticas são calculadas no backend a partir dos registros MySQL. Há testes automatizados de cálculos em `tests/order-statistics.test.mjs` e `tests/order-statistics-extended.test.mjs`:

```bash
npx tsc --noEmit
npm run build
node --experimental-strip-types --test tests/order-statistics*.test.mjs
```

No banco **exclusivamente de desenvolvimento**, `db/seed_pedidos_teste.sql` insere 24 pedidos fictícios e apresenta consultas estatísticas. O script `db/verificar_estatisticas_pedidos.sql` é somente de leitura e compara esses registros com valores esperados:

```bash
mysql -u root -p casa_de_racao < db/verificar_estatisticas_pedidos.sql
```

O endpoint `/api/orders/statistics` inclui **todos os pedidos** do banco; os scripts SQL de conferência filtram somente os identificadores de teste. Testes legados em `scripts/verify-*.mjs`, envolvendo D1/SQLite, não comprovam o funcionamento da aplicação atual em MySQL.

## Entrega e validação

Foram realizados testes manuais de criação, início, conclusão e cancelamento de pedidos, acesso pelo aplicativo mobile e sincronização com o sistema web.

Para a entrega do PI, a equipe ainda deve reunir evidências do uso com o estabelecimento, registrar o feedback recebido e revisar a documentação final e a apresentação.

---
Projeto desenvolvido para aplicação prática dos conteúdos de Padrões de Projeto, Estatística Aplicada, Desenvolvimento de Dispositivos Móveis e Programação de Scripts.
