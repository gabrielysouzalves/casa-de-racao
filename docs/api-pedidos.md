# API de pedidos e estatísticas

A API é utilizada pelo painel web e pelo aplicativo mobile. Os dados ficam no MySQL, na tabela `pedidos`.

## Autenticação

Todas as rotas de pedidos exigem login. O site utiliza um cookie de sessão `racao_session`. O aplicativo utiliza um token de sessão no cabeçalho `Authorization: Bearer <token>`.

O login mobile é feito com `POST /api/auth`:

```json
{
  "action": "mobileLogin",
  "username": "usuario",
  "password": "senha"
}
```

A resposta inclui `user` e `token`. O token é temporário e não deve ser publicado, registrado em logs ou enviado ao repositório. O login mobile está previsto para testes locais; o uso fora da rede local exige HTTPS. O site continua utilizando a ação `login` e cookies.

## Pedidos

### GET /api/orders

Retorna `{ "orders": [...] }` com os pedidos mais recentes primeiro.

O filtro `?status=AGUARDANDO` retorna a fila em ordem de chegada. Também aceita `EM_ATENDIMENTO`, `CONCLUIDO` e `CANCELADO`.

### POST /api/orders

Cria um pedido com status inicial `AGUARDANDO`:

```json
{ "type": "ENTREGA" }
```

Também aceita `PRESENCIAL`. Resposta: HTTP 201, com `message` e `order`.

### PATCH /api/orders

Altera a situação de um pedido:

```json
{
  "id": "uuid-do-pedido",
  "status": "EM_ATENDIMENTO"
}
```

Regras de transição:

| Situação atual | Próxima situação permitida |
| --- | --- |
| AGUARDANDO | EM_ATENDIMENTO ou CANCELADO |
| EM_ATENDIMENTO | CONCLUIDO ou CANCELADO |
| CONCLUIDO | Nenhuma |
| CANCELADO | Nenhuma |

Transições inválidas retornam HTTP 409. Dados inválidos retornam HTTP 400. Sem autenticação, a API retorna HTTP 401. Nos pedidos criados e atualizados, os horários de criação, início, conclusão e cancelamento são salvos no banco.

## Estatísticas

### GET /api/orders/statistics

Retorna as contagens totais, por tipo e por status, além dos indicadores de tempo de espera e atendimento.

Cada indicador inclui `count`, `mean`, `median`, `minimum`, `maximum`, `variance` e `standardDeviation`. Os tempos são expressos em **minutos**. A variância é **populacional** (dividida por N). Os cálculos consideram apenas registros com horários válidos.

## Estrutura e padrões de projeto

- **Modelos:** `lib/orders/types.ts` define `Order`, `OrderType` e `OrderStatus`.
- **Factory Method:** `lib/orders/OrderFactory.ts` possui fábricas para pedidos presenciais e entregas.
- **Singleton:** `lib/orders/OrderManager.ts` oferece uma instância compartilhada para regras de status e cálculos de duração.
- **Estatística:** `lib/orders/OrderStatistics.ts` concentra os cálculos, separados das rotas.
- **Controllers/rotas:** `app/api/orders/route.ts` e `app/api/orders/statistics/route.ts` validam requisições, exigem autenticação e delegam operações ao serviço.
- **Service:** `lib/orders/OrderService.ts` coordena criação, transições de status e cálculo das estatísticas.
- **Repository:** `lib/orders/OrderRepository.ts` centraliza as consultas e atualizações da tabela `pedidos` no MySQL.
- **Interfaces:** `components/store/OrdersView.tsx` no painel web e `mobile/App.tsx` no Android.

A aplicação usa uma **separação em camadas inspirada no MVC**: interfaces, rotas/controladores, serviços de negócio e repositório de persistência. Não é uma implementação de MVC clássico em todas as partes.

## Testes realizados em 18/11/2026

Testes manuais executados na máquina de desenvolvimento e em um celular Android:

- Login web e mobile, consulta e criação de pedidos.
- Início, conclusão e cancelamento de atendimentos.
- Sincronização dos pedidos entre web, API e MySQL.
- Consulta de estatísticas após registros de diferentes tipos e status.
- Exibição de notificações locais no mobile, com tratamento alternativo por aviso interno.

Os testes demonstram os cenários executados, mas não substituem testes automatizados, testes de carga ou validação de implantação externa.

## Observações para entrega

- Os pedidos não contêm produtos, valores, endereço de entrega ou associação direta a vendas. O módulo atual controla o **fluxo de atendimento**, não a venda completa.
- Notificações são locais, geradas após ações feitas no próprio aplicativo. Não há notificações push entre dispositivos.
- O servidor MySQL precisa estar configurado antes de executar as rotas.
- As evidências de uso com a loja (prints, fotos e feedback) devem ser registradas separadamente, conforme o roteiro do PI.

## Validação das estatísticas no MySQL

Para inserir os 24 pedidos fictícios (somente no banco de desenvolvimento), execute `db/seed_pedidos_teste.sql`. Para conferir separadamente contagens, tempos médios, variância populacional e desvio-padrão, execute `db/verificar_estatisticas_pedidos.sql`. O segundo arquivo é apenas de leitura e compara os resultados com os valores esperados da massa original.

```bash
mysql -u root -p casa_de_racao < db/verificar_estatisticas_pedidos.sql
node --experimental-strip-types --test tests/order-statistics*.test.mjs
```

A API usa todos os pedidos cadastrados, enquanto o SQL de conferência filtra apenas os identificadores reservados para testes. As estatísticas serão diferentes quando houver outros registros no banco.
