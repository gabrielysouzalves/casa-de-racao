import type { Order, OrderType } from './types';

type StatisticalSummary = {
  count: number;
  mean: number | null;
  median: number | null;
  minimum: number | null;
  maximum: number | null;
  variance: number | null;
  standardDeviation: number | null;
};

type OrderStatusCounts = Record<Order['status'], number>;

type TypeStatistics = {
  totalOrders: number;
  byStatus: OrderStatusCounts;
  waitingTime: StatisticalSummary;
  serviceTime: StatisticalSummary;
  cancellationRate: number | null;
};

type ArrivalPeriod = {
  period: string;
  total: number;
  byType: Record<OrderType, number>;
};

export type OrderStatisticsResult = {
  totalOrders: number;
  byType: Record<OrderType, number>;
  byStatus: OrderStatusCounts;
  waitingTime: StatisticalSummary;
  serviceTime: StatisticalSummary;
  byTypeStatistics: Record<OrderType, TypeStatistics>;
  cancellationRate: number | null;
  arrivalsByDay: ArrivalPeriod[];
  arrivalsByHour: ArrivalPeriod[];
  arrivalRate: {
    windowHours: number;
    totalPerHour: number;
    byTypePerHour: Record<OrderType, number>;
  } | null;
};

const types: OrderType[] = ['PRESENCIAL', 'ENTREGA'];

function emptyStatuses(): OrderStatusCounts {
  return { AGUARDANDO: 0, EM_ATENDIMENTO: 0, CONCLUIDO: 0, CANCELADO: 0 };
}

function summarize(values: number[]): StatisticalSummary {
  const count = values.length;
  if (count === 0) {
    return {
      count: 0, mean: null, median: null, minimum: null, maximum: null,
      variance: null, standardDeviation: null,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, value) => sum + value, 0) / count;
  const middle = Math.floor(count / 2);
  const median = count % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / count;

  return {
    count, mean, median, minimum: sorted[0], maximum: sorted[count - 1],
    variance, standardDeviation: Math.sqrt(variance),
  };
}

function rate(part: number, total: number): number | null {
  return total === 0 ? null : (part / total) * 100;
}

function periodEntry(period: string): ArrivalPeriod {
  return { period, total: 0, byType: { PRESENCIAL: 0, ENTREGA: 0 } };
}

export function calculateOrderStatistics(orders: Order[]): OrderStatisticsResult {
  const waitingTimes: number[] = [];
  const serviceTimes: number[] = [];
  const byType: Record<OrderType, number> = { PRESENCIAL: 0, ENTREGA: 0 };
  const byStatus = emptyStatuses();
  const grouped = {
    PRESENCIAL: { waitingTimes: [] as number[], serviceTimes: [] as number[], byStatus: emptyStatuses() },
    ENTREGA: { waitingTimes: [] as number[], serviceTimes: [] as number[], byStatus: emptyStatuses() },
  };
  const days = new Map<string, ArrivalPeriod>();
  const hours = new Map<string, ArrivalPeriod>();
  let earliestCreatedAt = Infinity;
  let latestCreatedAt = -Infinity;
  let validCreatedTotal = 0;
  const validCreatedCount: Record<OrderType, number> = { PRESENCIAL: 0, ENTREGA: 0 };

  for (const order of orders) {
    byType[order.type]++;
    byStatus[order.status]++;
    const group = grouped[order.type];
    group.byStatus[order.status]++;

    const created = new Date(order.createdAt).getTime();
    if (Number.isFinite(created)) {
      earliestCreatedAt = Math.min(earliestCreatedAt, created);
      latestCreatedAt = Math.max(latestCreatedAt, created);
      validCreatedTotal++;
      validCreatedCount[order.type]++;
      const iso = new Date(created).toISOString();
      for (const [map, period] of [
        [days, iso.slice(0, 10)],
        [hours, `${iso.slice(0, 13)}:00:00Z`],
      ] as const) {
        const entry = map.get(period) ?? periodEntry(period);
        entry.total++;
        entry.byType[order.type]++;
        map.set(period, entry);
      }
    }

    if (order.startedAt) {
      const waitingMinutes = (new Date(order.startedAt).getTime() - created) / 60000;
      if (Number.isFinite(waitingMinutes) && waitingMinutes >= 0) {
        waitingTimes.push(waitingMinutes);
        group.waitingTimes.push(waitingMinutes);
      }
    }

    if (order.startedAt && order.completedAt) {
      const serviceMinutes = (
        new Date(order.completedAt).getTime() - new Date(order.startedAt).getTime()
      ) / 60000;
      if (Number.isFinite(serviceMinutes) && serviceMinutes >= 0) {
        serviceTimes.push(serviceMinutes);
        group.serviceTimes.push(serviceMinutes);
      }
    }
  }

  const byTypeStatistics = {} as Record<OrderType, TypeStatistics>;
  for (const type of types) {
    byTypeStatistics[type] = {
      totalOrders: byType[type],
      byStatus: grouped[type].byStatus,
      waitingTime: summarize(grouped[type].waitingTimes),
      serviceTime: summarize(grouped[type].serviceTimes),
      cancellationRate: rate(grouped[type].byStatus.CANCELADO, byType[type]),
    };
  }

  const windowHours = validCreatedTotal
    ? Math.max(1, Math.ceil((latestCreatedAt - earliestCreatedAt) / 3600000))
    : null;

  return {
    totalOrders: orders.length,
    byType,
    byStatus,
    waitingTime: summarize(waitingTimes),
    serviceTime: summarize(serviceTimes),
    byTypeStatistics,
    cancellationRate: rate(byStatus.CANCELADO, orders.length),
    arrivalsByDay: [...days.values()].sort((a, b) => a.period.localeCompare(b.period)),
    arrivalsByHour: [...hours.values()].sort((a, b) => a.period.localeCompare(b.period)),
    arrivalRate: windowHours === null ? null : {
      windowHours,
      totalPerHour: validCreatedTotal / windowHours,
      byTypePerHour: {
        PRESENCIAL: validCreatedCount.PRESENCIAL / windowHours,
        ENTREGA: validCreatedCount.ENTREGA / windowHours,
      },
    },
  };
}
