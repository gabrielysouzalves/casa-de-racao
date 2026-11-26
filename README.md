# 🐾 Sistema de Gerenciamento para Casa de Rações

## 📌 Sobre o projeto

O **Sistema de Gerenciamento para Casa de Rações** foi desenvolvido para facilitar a rotina de uma loja de produtos para animais, reunindo em um só lugar o controle de estoque, vendas, contas e atendimentos.

O projeto conta com um painel web e um aplicativo mobile para acompanhar os pedidos presenciais e de entrega.

## ⚙️ Funcionalidades

- **Produtos e estoque:** cadastro, consulta, edição e registro de entradas e saídas.
- **Vendas:** registro das vendas e atualização do estoque.
- **Financeiro:** acompanhamento de contas a pagar e despesas.
- **Usuários:** login e gerenciamento de perfis de acesso.
- **Pedidos:** controle da fila e das etapas do atendimento, pelo web ou celular.
- **Indicadores:** gráficos e estatísticas de espera, atendimento e chegada de pedidos.

## 🛠️ Tecnologias utilizadas

- **Web e API:** React, TypeScript, Node.js e Vite/Vinext.
- **Mobile:** React Native e Expo.
- **Banco de dados:** MySQL.
- **Arquitetura:** organização em camadas inspirada no MVC, com Service e Repository, além dos padrões Factory Method e Singleton.

## 💻 Como executar

É necessário ter **Node.js 22.13 ou superior**, **MySQL 8**, npm e Git instalados.

**1. Prepare o banco:** com o MySQL em execução, abra no MySQL Workbench os arquivos abaixo, nesta ordem:

- `db/schema_mysql_casa_de_racao.sql`
- `db/schema_pedidos.sql` (selecione antes o banco `casa_de_racao`).

**2. Instale as dependências**, na pasta do projeto:

```bash
npm install
```

**3. Crie o arquivo `.env`** a partir do `.env.example`.

No Windows (PowerShell):

```powershell
Copy-Item .env.example .env
```

No Linux/macOS:

```bash
cp .env.example .env
```

Preencha no `.env` os dados de conexão com o MySQL (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` e `DB_NAME`) e um `AUTH_PEPPER` aleatório com pelo menos 32 caracteres.

**4. Configure a senha inicial do administrador** (apenas na primeira instalação):

```bash
node --experimental-strip-types scripts/set-initial-admin-password.mjs
```

**5. Inicie o sistema:**

```bash
npm run dev
```

Abra **http://localhost:5173/** no navegador. O terminal deve permanecer aberto enquanto o sistema estiver funcionando.

Para executar a versão compilada, use `npm run build` e `npm start` (porta 3000).

## 📱 Aplicativo mobile

Com o servidor web/API em execução, abra outro terminal:

```bash
cd mobile
npm install
npx expo start
```

Abra o QR Code no **Expo Go**. O celular e o computador devem estar na mesma rede. No aplicativo, informe o IP do computador e a porta do servidor. Mais detalhes em [mobile/README.md](mobile/README.md).

---

Projeto interdisciplinar desenvolvido para aplicar conhecimentos de desenvolvimento de sistemas, padrões de projeto, estatística e dispositivos móveis.
