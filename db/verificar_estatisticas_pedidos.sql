-- Conferencia independente das estatisticas dos pedidos de teste.
-- Leitura apenas: nenhuma tabela ou registro e alterado.
-- Execute: mysql -u root -p casa_de_racao < db/verificar_estatisticas_pedidos.sql
-- Os valores esperados correspondem a massa original de 24 pedidos.
-- Se os pedidos de teste foram atualizados pelo aplicativo, os resultados podem mudar.

USE casa_de_racao;

SELECT
  'Total de pedidos de teste' AS indicador,
  COUNT(*) AS resultado,
  24 AS esperado,
  IF(COUNT(*) = 24, 'OK', 'REVISAR') AS situacao
FROM pedidos
WHERE pedido_cod LIKE '11111111-1111-4111-8111-%';

SELECT
  tipo,
  status,
  COUNT(*) AS quantidade
FROM pedidos
WHERE pedido_cod LIKE '11111111-1111-4111-8111-%'
GROUP BY tipo, status
ORDER BY tipo, status;

WITH tempos AS (
  SELECT
    tipo,
    status,
    CASE WHEN iniciado_em IS NOT NULL AND iniciado_em >= criado_em
      THEN TIMESTAMPDIFF(MICROSECOND, criado_em, iniciado_em) / 60000000.0
      ELSE NULL END AS espera_min,
    CASE WHEN iniciado_em IS NOT NULL AND concluido_em IS NOT NULL
           AND concluido_em >= iniciado_em
      THEN TIMESTAMPDIFF(MICROSECOND, iniciado_em, concluido_em) / 60000000.0
      ELSE NULL END AS atendimento_min
  FROM pedidos
  WHERE pedido_cod LIKE '11111111-1111-4111-8111-%'
),
resumo AS (
  SELECT
    COUNT(*) AS pedidos,
    COUNT(espera_min) AS n_espera,
    AVG(espera_min) AS media_espera,
    VAR_POP(espera_min) AS variancia_espera,
    STDDEV_POP(espera_min) AS desvio_espera,
    COUNT(atendimento_min) AS n_atendimento,
    AVG(atendimento_min) AS media_atendimento,
    VAR_POP(atendimento_min) AS variancia_atendimento,
    STDDEV_POP(atendimento_min) AS desvio_atendimento
  FROM tempos
)
SELECT
  pedidos,
  n_espera,
  ROUND(media_espera, 4) AS media_espera_min,
  ROUND(variancia_espera, 4) AS variancia_espera_min2,
  ROUND(desvio_espera, 4) AS desvio_espera_min,
  n_atendimento,
  ROUND(media_atendimento, 4) AS media_atendimento_min,
  ROUND(variancia_atendimento, 4) AS variancia_atendimento_min2,
  ROUND(desvio_atendimento, 4) AS desvio_atendimento_min,
  IF(
    pedidos = 24
    AND n_espera = 17
    AND ABS(media_espera - 29.6470588235) < 0.0001
    AND ABS(variancia_espera - 1737.169550173) < 0.01
    AND n_atendimento = 12
    AND ABS(media_atendimento - 23.9166666667) < 0.0001,
    'OK', 'REVISAR'
  ) AS situacao
FROM resumo;

WITH tempos AS (
  SELECT
    tipo,
    CASE WHEN iniciado_em IS NOT NULL AND iniciado_em >= criado_em
      THEN TIMESTAMPDIFF(MICROSECOND, criado_em, iniciado_em) / 60000000.0 END AS espera_min,
    CASE WHEN iniciado_em IS NOT NULL AND concluido_em IS NOT NULL
              AND concluido_em >= iniciado_em
      THEN TIMESTAMPDIFF(MICROSECOND, iniciado_em, concluido_em) / 60000000.0 END AS atendimento_min
  FROM pedidos
  WHERE pedido_cod LIKE '11111111-1111-4111-8111-%'
)
SELECT
  tipo,
  COUNT(*) AS pedidos,
  COUNT(espera_min) AS esperas_validas,
  ROUND(AVG(espera_min), 4) AS espera_media_min,
  ROUND(VAR_POP(espera_min), 4) AS variancia_espera_min2,
  ROUND(STDDEV_POP(espera_min), 4) AS desvio_espera_min,
  COUNT(atendimento_min) AS atendimentos_validos,
  ROUND(AVG(atendimento_min), 4) AS atendimento_medio_min,
  ROUND(VAR_POP(atendimento_min), 4) AS variancia_atendimento_min2,
  ROUND(STDDEV_POP(atendimento_min), 4) AS desvio_atendimento_min
FROM tempos
GROUP BY tipo
ORDER BY tipo;

SELECT
  DATE(criado_em) AS dia,
  tipo,
  COUNT(*) AS chegadas
FROM pedidos
WHERE pedido_cod LIKE '11111111-1111-4111-8111-%'
GROUP BY DATE(criado_em), tipo
ORDER BY dia, tipo;

-- Importante: /api/orders/statistics calcula sobre todos os pedidos cadastrados.
-- Para comparar o SQL com a API, consulte os mesmos registros e intervalos.
