import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateOrderStatistics } from '../lib/orders/OrderStatistics.ts';

const reference = Date.parse('2026-11-20T10:00:00.000Z');
const at = (minutes) => new Date(reference + minutes * 60000).toISOString();

function order(id, type, status, started = null, completed = null, created = 0) {
  return {
    id,
    type,
    status,
    createdAt: at(created),
    startedAt: started === null ? null : at(started),
    completedAt: completed === null ? null : at(completed),
    cancelledAt: null,
  };
}

test('mantém os cálculos gerais e acrescenta estatísticas por tipo', () => {
  const result = calculateOrderStatistics([
    order('1', 'PRESENCIAL', 'CONCLUIDO', 10, 15),
    order('2', 'ENTREGA', 'CONCLUIDO', 20, 35),
    order('3', 'PRESENCIAL', 'EM_ATENDIMENTO', 30),
    order('4', 'ENTREGA', 'AGUARDANDO'),
    order('5', 'ENTREGA', 'CANCELADO'),
  ]);

  assert.equal(result.totalOrders, 5);
  assert.equal(result.waitingTime.mean, 20);
  assert.equal(result.serviceTime.mean, 10);
  assert.equal(result.byTypeStatistics.PRESENCIAL.totalOrders, 2);
  assert.equal(result.byTypeStatistics.ENTREGA.totalOrders, 3);
  assert.equal(result.byTypeStatistics.PRESENCIAL.waitingTime.mean, 20);
  assert.equal(result.byTypeStatistics.ENTREGA.waitingTime.mean, 20);
  assert.equal(result.byTypeStatistics.PRESENCIAL.serviceTime.mean, 5);
  assert.equal(result.byTypeStatistics.ENTREGA.serviceTime.mean, 15);
  assert.ok(Math.abs(result.byTypeStatistics.ENTREGA.cancellationRate - 100 / 3) < 1e-10);
  assert.equal(result.cancellationRate, 20);
});

test('agrupa chegadas por dia e hora UTC e calcula a taxa no período observado', () => {
  const result = calculateOrderStatistics([
    order('1', 'PRESENCIAL', 'AGUARDANDO', null, null, 0),
    order('2', 'ENTREGA', 'AGUARDANDO', null, null, 30),
    order('3', 'PRESENCIAL', 'AGUARDANDO', null, null, 90),
    order('4', 'ENTREGA', 'AGUARDANDO', null, null, 1470),
  ]);

  assert.deepEqual(
    result.arrivalsByDay.map(({ period, total }) => [period, total]),
    [['2026-11-20', 3], ['2026-11-21', 1]]
  );
  assert.deepEqual(result.arrivalsByHour.map(({ total }) => total), [2, 1, 1]);
  assert.equal(result.arrivalRate.windowHours, 25);
  assert.equal(result.arrivalRate.totalPerHour, 4 / 25);
  assert.equal(result.arrivalRate.byTypePerHour.PRESENCIAL, 2 / 25);
  assert.equal(result.arrivalRate.byTypePerHour.ENTREGA, 2 / 25);
});

test('ignora datas inválidas na taxa de chegada e trata conjuntos vazios', () => {
  const invalid = order('1', 'ENTREGA', 'AGUARDANDO');
  invalid.createdAt = 'data-invalida';
  const result = calculateOrderStatistics([invalid]);

  assert.equal(result.totalOrders, 1);
  assert.equal(result.arrivalRate, null);
  assert.deepEqual(result.arrivalsByDay, []);
  assert.equal(result.byTypeStatistics.PRESENCIAL.cancellationRate, null);

  const empty = calculateOrderStatistics([]);
  assert.equal(empty.arrivalRate, null);
  assert.equal(empty.cancellationRate, null);
  assert.deepEqual(empty.arrivalsByHour, []);
});
