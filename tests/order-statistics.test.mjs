import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateOrderStatistics } from '../lib/orders/OrderStatistics.ts';

const BASE = Date.parse('2026-11-20T10:00:00.000Z');
const at = (minutes) => new Date(BASE + minutes * 60_000).toISOString();

function order(id, type, status, started = null, completed = null, cancelled = null) {
  return {
    id,
    type,
    status,
    createdAt: at(0),
    startedAt: started === null ? null : at(started),
    completedAt: completed === null ? null : at(completed),
    cancelledAt: cancelled === null ? null : at(cancelled),
  };
}

function near(actual, expected) {
  assert.ok(actual !== null && Math.abs(actual - expected) < 1e-10,
    `Esperado ${expected}, recebido ${actual}`);
}

test('retorna contagens zeradas e medidas nulas quando não há pedidos', () => {
  const result = calculateOrderStatistics([]);
  assert.equal(result.totalOrders, 0);
  assert.deepEqual(result.byType, { PRESENCIAL: 0, ENTREGA: 0 });
  assert.deepEqual(result.byStatus, {
    AGUARDANDO: 0, EM_ATENDIMENTO: 0, CONCLUIDO: 0, CANCELADO: 0,
  });
  for (const summary of [result.waitingTime, result.serviceTime]) {
    assert.deepEqual(summary, {
      count: 0, mean: null, median: null, minimum: null, maximum: null,
      variance: null, standardDeviation: null,
    });
  }
});

test('calcula contagens e estatísticas populacionais sem incluir tempos incompletos', () => {
  const orders = [
    order('1', 'PRESENCIAL', 'CONCLUIDO', 10, 15),
    order('2', 'ENTREGA', 'CONCLUIDO', 20, 35),
    order('3', 'PRESENCIAL', 'EM_ATENDIMENTO', 30),
    order('4', 'ENTREGA', 'AGUARDANDO'),
    order('5', 'ENTREGA', 'CANCELADO', null, null, 2),
  ];
  const result = calculateOrderStatistics(orders);
  assert.equal(result.totalOrders, 5);
  assert.deepEqual(result.byType, { PRESENCIAL: 2, ENTREGA: 3 });
  assert.deepEqual(result.byStatus, {
    AGUARDANDO: 1, EM_ATENDIMENTO: 1, CONCLUIDO: 2, CANCELADO: 1,
  });
  assert.equal(result.waitingTime.count, 3);
  assert.equal(result.waitingTime.mean, 20);
  assert.equal(result.waitingTime.median, 20);
  assert.equal(result.waitingTime.minimum, 10);
  assert.equal(result.waitingTime.maximum, 30);
  near(result.waitingTime.variance, 200 / 3);
  near(result.waitingTime.standardDeviation, Math.sqrt(200 / 3));
  assert.deepEqual(result.serviceTime, {
    count: 2, mean: 10, median: 10, minimum: 5, maximum: 15,
    variance: 25, standardDeviation: 5,
  });
});

test('calcula mediana para quantidade par e preserva tempos zero', () => {
  const result = calculateOrderStatistics([
    order('1', 'PRESENCIAL', 'CONCLUIDO', 0, 0),
    order('2', 'ENTREGA', 'CONCLUIDO', 10, 20),
    order('3', 'PRESENCIAL', 'CONCLUIDO', 20, 30),
    order('4', 'ENTREGA', 'CONCLUIDO', 30, 50),
  ]);
  assert.equal(result.waitingTime.median, 15);
  assert.equal(result.waitingTime.mean, 15);
  assert.equal(result.waitingTime.minimum, 0);
  assert.equal(result.waitingTime.maximum, 30);
  assert.equal(result.waitingTime.variance, 125);
  assert.equal(result.serviceTime.median, 10);
  assert.equal(result.serviceTime.minimum, 0);
});

test('descarta intervalos negativos ou datas inválidas sem perder contagem do pedido', () => {
  const invalidCreated = order('1', 'PRESENCIAL', 'EM_ATENDIMENTO', 10);
  invalidCreated.createdAt = 'data-invalida';
  const negativeWait = order('2', 'ENTREGA', 'CONCLUIDO', -5, 15);
  const negativeService = order('3', 'PRESENCIAL', 'CONCLUIDO', 15, 5);
  const invalidCompleted = order('4', 'ENTREGA', 'CONCLUIDO', 20, 30);
  invalidCompleted.completedAt = 'data-invalida';

  const result = calculateOrderStatistics([
    invalidCreated, negativeWait, negativeService, invalidCompleted,
  ]);
  assert.equal(result.totalOrders, 4);
  assert.equal(result.waitingTime.count, 2);
  assert.equal(result.waitingTime.mean, 17.5);
  assert.equal(result.serviceTime.count, 1);
  assert.equal(result.serviceTime.mean, 20);
});

test('inclui espera de pedido cancelado após início, mas não inventa duração de atendimento', () => {
  const result = calculateOrderStatistics([
    order('1', 'PRESENCIAL', 'CANCELADO', 7, null, 10),
    order('2', 'ENTREGA', 'AGUARDANDO'),
  ]);
  assert.equal(result.waitingTime.count, 1);
  assert.equal(result.waitingTime.mean, 7);
  assert.equal(result.waitingTime.variance, 0);
  assert.equal(result.serviceTime.count, 0);
  assert.equal(result.serviceTime.mean, null);
});
