'use client';

import { useEffect, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { OrderStatisticsResult } from '@/lib/orders/OrderStatistics';

type Props = {
  refreshKey: number;
  onSessionExpired: () => void;
};

const number = (value: number | null | undefined, digits = 1) =>
  value == null ? '—' : value.toLocaleString('pt-BR', {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  });

const minutes = (value: number | null | undefined) =>
  value == null ? '—' : `${number(value)} min`;

const TYPES = [
  { key: 'PRESENCIAL', label: 'Presencial' },
  { key: 'ENTREGA', label: 'Entrega' },
] as const;

function Metric({ title, value, note }: {
  title: string;
  value: string | number;
  note?: string;
}) {
  return (
    <div className="metric">
      <span>{title}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel" style={{ minWidth: 0 }}>
      <div className="panel-head"><h2>{title}</h2></div>
      {children}
    </section>
  );
}

export default function OrdersStatisticsPanel({ refreshKey, onSessionExpired }: Props) {
  const [stats, setStats] = useState<OrderStatisticsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch('/api/orders/statistics', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (response.status === 401) {
          onSessionExpired();
          return;
        }
        const result = await response.json() as OrderStatisticsResult & { error?: string };
        if (!response.ok) {
          throw new Error(result.error || 'Não foi possível consultar as estatísticas.');
        }
        if (!controller.signal.aborted) {
          setStats(result);
          setError('');
        }
      } catch (reason) {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : 'Erro ao carregar estatísticas.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [refreshKey, onSessionExpired]);

  if (loading) return <section className="panel"><p>Carregando indicadores de atendimento...</p></section>;
  if (error) return <section className="panel" role="alert"><p>{error}</p></section>;
  if (!stats || !stats.totalOrders) {
    return <section className="panel"><h2>Indicadores de atendimento</h2><p>Os indicadores aparecerão após o cadastro dos primeiros pedidos.</p></section>;
  }

  const typeComparison = TYPES.map(({ key, label }) => ({
    tipo: label,
    'Espera média': stats.byTypeStatistics[key].waitingTime.mean,
    'Atendimento médio': stats.byTypeStatistics[key].serviceTime.mean,
  }));

  const timeline = stats.arrivalsByDay.map((item) => ({
    data: `${item.period.slice(8, 10)}/${item.period.slice(5, 7)}`,
    'Presencial': item.byType.PRESENCIAL,
    'Entrega': item.byType.ENTREGA,
    'Total': item.total,
  }));

  return (
    <section aria-label="Indicadores estatísticos de atendimento">
      <div className="panel-head" style={{ marginTop: 22 }}>
        <div>
          <h2>Indicadores de atendimento</h2>
          <p>Tempos em minutos e dados de chegada agrupados por dia UTC.</p>
        </div>
      </div>

      <div className="metrics">
        <Metric title="Total de pedidos" value={stats.totalOrders} />
        <Metric title="Espera média" value={minutes(stats.waitingTime.mean)} note={`${stats.waitingTime.count} registros válidos`} />
        <Metric title="Atendimento médio" value={minutes(stats.serviceTime.mean)} note={`${stats.serviceTime.count} registros válidos`} />
        <Metric title="Cancelamentos" value={stats.byStatus.CANCELADO} note={`${number(stats.cancellationRate)}% do total`} />
      </div>

      <div className="metrics">
        <Metric title="Presenciais" value={stats.byType.PRESENCIAL} />
        <Metric title="Entregas" value={stats.byType.ENTREGA} />
        <Metric title="Taxa de chegada" value={stats.arrivalRate ? `${number(stats.arrivalRate.totalPerHour, 2)}/h` : '—'}
          note={stats.arrivalRate ? `Janela observada: ${stats.arrivalRate.windowHours} h` : 'Sem registros com data válida'} />
        <Metric title="Desvio-padrão da espera" value={minutes(stats.waitingTime.standardDeviation)} />
      </div>

      <div className="dashboard-grid">
        <ChartPanel title="Tempos médios por tipo de pedido">
          <div style={{ height: 280, minWidth: 0 }} role="img"
            aria-label="Comparação da espera média e do atendimento médio por tipo de pedido">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeComparison} margin={{ top: 12, right: 12, left: 2, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="tipo" />
                <YAxis unit=" min" width={65} />
                <Tooltip formatter={(value) => minutes(typeof value === 'number' ? value : null)} />
                <Legend />
                <Bar dataKey="Espera média" fill="#3f8c73" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Atendimento médio" fill="#6396cc" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <ChartPanel title="Chegada de pedidos por dia">
          <div style={{ height: 280, minWidth: 0 }} role="img"
            aria-label="Quantidade diária de pedidos presenciais e entregas">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeline} margin={{ top: 12, right: 12, left: 2, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="data" />
                <YAxis allowDecimals={false} width={35} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Presencial" stroke="#3f8c73" strokeWidth={2} />
                <Line type="monotone" dataKey="Entrega" stroke="#6396cc" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>
      </div>

      <section className="panel">
        <div className="panel-head"><h2>Resumo estatístico por categoria</h2></div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr>
                <th scope="col">Indicador</th>
                <th scope="col">Geral</th>
                <th scope="col">Presencial</th>
                <th scope="col">Entrega</th>
              </tr>
            </thead>
            <tbody>
              {([
                ['Espera média (min)', 'waitingTime', 'mean'],
                ['Mediana da espera (min)', 'waitingTime', 'median'],
                ['Mín. de espera (min)', 'waitingTime', 'minimum'],
                ['Máx. de espera (min)', 'waitingTime', 'maximum'],
                ['Variância da espera (min²)', 'waitingTime', 'variance'],
                ['Desvio-padrão da espera (min)', 'waitingTime', 'standardDeviation'],
                ['Atendimento médio (min)', 'serviceTime', 'mean'],
                ['Mediana do atendimento (min)', 'serviceTime', 'median'],
                ['Mín. de atendimento (min)', 'serviceTime', 'minimum'],
                ['Máx. de atendimento (min)', 'serviceTime', 'maximum'],
                ['Variância do atendimento (min²)', 'serviceTime', 'variance'],
                ['Desvio-padrão do atendimento (min)', 'serviceTime', 'standardDeviation'],
              ] as const).map(([label, measure, field]) => (
                <tr key={label} style={{ borderTop: '1px solid #d9e2dd' }}>
                  <th scope="row" style={{ padding: '9px 12px 9px 0', fontWeight: 500 }}>{label}</th>
                  <td>{number(stats[measure][field], 2)}</td>
                  <td>{number(stats.byTypeStatistics.PRESENCIAL[measure][field], 2)}</td>
                  <td>{number(stats.byTypeStatistics.ENTREGA[measure][field], 2)}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '1px solid #d9e2dd' }}>
                <th scope="row" style={{ padding: '9px 12px 9px 0', fontWeight: 500 }}>Cancelamentos (%)</th>
                <td>{number(stats.cancellationRate, 2)}</td>
                <td>{number(stats.byTypeStatistics.PRESENCIAL.cancellationRate, 2)}</td>
                <td>{number(stats.byTypeStatistics.ENTREGA.cancellationRate, 2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="subheading">
          Variância populacional (divisão por N). Tempos calculados apenas para registros com horários válidos.
          A taxa de chegada usa o intervalo entre o primeiro e o último pedido, com duração mínima de uma hora.
        </p>
      </section>
    </section>
  );
}
