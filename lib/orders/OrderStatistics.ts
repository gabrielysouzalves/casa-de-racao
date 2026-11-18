import type { Order } from './types';

type StatisticalSummary = {
  count: number;
  mean: number | null;
  median: number | null;
  minimum: number | null;
  maximum: number | null;
  variance: number | null;
  standardDeviation: number | null;
};

export type OrderStatisticsResult = {
  totalOrders: number;
  byType: {
    PRESENCIAL: number;
    ENTREGA: number;
  };
  byStatus: Record<Order['status'], number>;
  waitingTime: StatisticalSummary;
  serviceTime: StatisticalSummary;
};

// Calcula medidas estatísticas de uma lista de valores.
function summarize(values: number[]): StatisticalSummary {
  const count = values.length;

  if (count === 0) {
    return {
      count: 0,
      mean: null,
      median: null,
      minimum: null,
      maximum: null,
      variance: null,
      standardDeviation: null,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);

  const mean =
    values.reduce((sum, value) => sum + value, 0) / count;

  const middle = Math.floor(count / 2);

  const median =
    count % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];

  // Variância populacional (divisão por N).
  const variance =
    values.reduce(
      (sum, value) => sum + (value - mean) ** 2,
      0
    ) / count;

  return {
    count,
    mean,
    median,
    minimum: sorted[0],
    maximum: sorted[count - 1],
    variance,
    standardDeviation: Math.sqrt(variance),
  };
}

export function calculateOrderStatistics(
  orders: Order[]
): OrderStatisticsResult {
  const waitingTimes: number[] = [];
  const serviceTimes: number[] = [];

  const byType = {
    PRESENCIAL: 0,
    ENTREGA: 0,
  };

  const byStatus: Record<Order['status'], number> = {
    AGUARDANDO: 0,
    EM_ATENDIMENTO: 0,
    CONCLUIDO: 0,
    CANCELADO: 0,
  };

  for (const order of orders) {
    byType[order.type]++;
    byStatus[order.status]++;

    if (order.startedAt) {
      const waitingMinutes =
        (new Date(order.startedAt).getTime() -
          new Date(order.createdAt).getTime()) /
        60000;

      if (Number.isFinite(waitingMinutes) && waitingMinutes >= 0) {
        waitingTimes.push(waitingMinutes);
      }
    }

    if (order.startedAt && order.completedAt) {
      const serviceMinutes =
        (new Date(order.completedAt).getTime() -
          new Date(order.startedAt).getTime()) /
        60000;

      if (Number.isFinite(serviceMinutes) && serviceMinutes >= 0) {
        serviceTimes.push(serviceMinutes);
      }
    }
  }

  return {
    totalOrders: orders.length,
    byType,
    byStatus,
    waitingTime: summarize(waitingTimes),
    serviceTime: summarize(serviceTimes),
  };
}