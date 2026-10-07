# Casa de Ração — sistema de gestão

Este projeto fica isolado na pasta casa-de-racao.

## Funcionalidades
- Cadastro de produtos e códigos de barras (preservados como texto).
- Entrada e saída de estoque com histórico e bloqueio de saldo negativo.
- Vendas com leitor USB em modo teclado e terminador Enter; carrinho com quantidade e baixa automática.
- Painel mensal com vendas, estoque baixo e pagamentos.
- Duplicatas por data de vencimento, valor e situação.
- Compras por MEI, razão social, data, valor e situação de pagamento.

O sistema registra pagamentos; não processa cartão, Pix ou boletos. O banco D1 mantém os registros no servidor. A publicação inicial tem acesso privado.

## Desenvolvimento local
Requer Node 22.13 ou superior. Instale com `npm run install:ci`. Execute `npm run db:generate` se alterar o schema e `npm run build`. Aplique as migrações pendentes em ordem:

```
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_windy_toro.sql
```

Use o nome real do arquivo em drizzle. Execute `npm run dev` para desenvolvimento ou `npm start` para servir o sistema compilado. O banco local é separado do banco publicado.

## Primeiro uso
1. Em Estoque, cadastre nome, código, preço e estoque mínimo.
2. Registre uma entrada com a quantidade disponível.
3. Em Vendas, clique no campo Código de barras e faça a leitura. Enter adiciona o produto; códigos desconhecidos mostram um aviso.
4. Confira as quantidades e finalize a venda.
5. Lance as duplicatas e as compras por MEI, marcando os pagamentos quando realizados.

Valores são armazenados em centavos. Produtos vendidos mantêm nome e preço do momento da venda no histórico. Operações de venda são atômicas: um item sem saldo impede a venda completa. Um leitor físico ainda precisa ser validado com o equipamento da loja.

