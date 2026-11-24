'use client';

import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, RefreshCw, Plus } from 'lucide-react';
import { toast } from 'sonner';
import OrdersStatisticsPanel from './OrdersStatisticsPanel';
import type { Order, OrderStatus, OrderType } from '@/lib/orders/types';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';

type OrdersViewProps = {
  onSessionExpired: () => void;
};

type OrdersResponse = { orders?: Order[]; error?: string };
type OrderResponse = { order?: Order; error?: string };

const statusLabels: Record<OrderStatus, string> = {
  AGUARDANDO: 'Aguardando',
  EM_ATENDIMENTO: 'Em atendimento',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
};

const statusColors: Record<OrderStatus, string> = {
  AGUARDANDO: 'amber',
  EM_ATENDIMENTO: 'blue',
  CONCLUIDO: 'green',
  CANCELADO: 'red',
};

const dateTime = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value));

export default function OrdersView({ onSessionExpired }: OrdersViewProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<OrderStatus | 'TODOS'>('TODOS');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [statisticsRefresh, setStatisticsRefresh] = useState(0);

  const loadOrders = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/orders', {
        cache: 'no-store',
        signal,
      });
      if (response.status === 401) {
        onSessionExpired();
        return;
      }
      const result = (await response.json()) as OrdersResponse;
      if (!response.ok) throw new Error(result.error || 'Não foi possível consultar os pedidos.');
      if (!signal?.aborted) setOrders(result.orders ?? []);
    } catch (error) {
      if (!signal?.aborted) {
        toast.error((error as Error).message);
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [onSessionExpired]);

  useEffect(() => {
    const controller = new AbortController();
    void loadOrders(controller.signal);
    return () => controller.abort();
  }, [loadOrders]);

  async function changeOrder(method: 'POST' | 'PATCH', payload: { type: OrderType } | { id: string; status: OrderStatus }) {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch('/api/orders', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.status === 401) {
        onSessionExpired();
        return;
      }
      const result = (await response.json()) as OrderResponse;
      if (!response.ok) throw new Error(result.error || 'Não foi possível salvar o pedido.');
      toast.success(method === 'POST' ? 'Pedido criado com sucesso.' : 'Pedido atualizado.');
      await loadOrders();
      setStatisticsRefresh((current) => current + 1);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const visibleOrders = orders
    .filter((order) => filter === 'TODOS' || order.status === filter)
    .sort((a, b) => filter === 'AGUARDANDO'
      ? a.createdAt.localeCompare(b.createdAt)
      : b.createdAt.localeCompare(a.createdAt));

  const waiting = orders.filter((order) => order.status === 'AGUARDANDO').length;
  const attending = orders.filter((order) => order.status === 'EM_ATENDIMENTO').length;
  const completed = orders.filter((order) => order.status === 'CONCLUIDO').length;

  return (
    <>
      <div className="metrics financial">
        <div className="metric">
          <span>Aguardando</span>
          <strong>{waiting}</strong>
        </div>
        <div className="metric">
          <span>Em atendimento</span>
          <strong>{attending}</strong>
        </div>
        <div className="metric">
          <span>Concluídos</span>
          <strong>{completed}</strong>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>Novo pedido</h2>
          <div className="heading-actions">
            <button className="primary" disabled={busy} onClick={() => void changeOrder('POST', { type: 'PRESENCIAL' })}>
              <Plus size={17} /> Presencial
            </button>
            <button className="secondary" disabled={busy} onClick={() => void changeOrder('POST', { type: 'ENTREGA' })}>
              <Plus size={17} /> Entrega
            </button>
          </div>
        </div>
        <p className="subheading">Cadastre os atendimentos para acompanhar a fila e os tempos de espera.</p>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Pedidos</h2>
          <div className="heading-actions">
            <label>
              <span className="sr-only">Filtrar pedidos</span>
              <select value={filter} onChange={(event) => setFilter(event.target.value as OrderStatus | 'TODOS')} aria-label="Filtrar pedidos">
                <option value="TODOS">Todos</option>
                <option value="AGUARDANDO">Aguardando</option>
                <option value="EM_ATENDIMENTO">Em atendimento</option>
                <option value="CONCLUIDO">Concluídos</option>
                <option value="CANCELADO">Cancelados</option>
              </select>
            </label>
            <button className="secondary" disabled={busy || loading} onClick={() => { setLoading(true); void loadOrders(); }}>
              <RefreshCw size={17} /> Atualizar
            </button>
          </div>
        </div>

        {loading ? (
          <div className="empty"><p>Carregando pedidos...</p></div>
        ) : visibleOrders.length === 0 ? (
          <div className="empty">
            <ClipboardList size={30} />
            <p>Nenhum pedido encontrado.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="code" title={order.id}>{order.id.slice(0, 8)}</TableCell>
                  <TableCell>{order.type === 'PRESENCIAL' ? 'Presencial' : 'Entrega'}</TableCell>
                  <TableCell>{dateTime(order.createdAt)}</TableCell>
                  <TableCell>
                    <span className={`badge ${statusColors[order.status]}`}>{statusLabels[order.status]}</span>
                  </TableCell>
                  <TableCell>
                    <div className="heading-actions">
                      {order.status === 'AGUARDANDO' && (
                        <button className="text-button" disabled={busy} onClick={() => void changeOrder('PATCH', { id: order.id, status: 'EM_ATENDIMENTO' })}>
                          Iniciar
                        </button>
                      )}
                      {order.status === 'EM_ATENDIMENTO' && (
                        <button className="text-button" disabled={busy} onClick={() => void changeOrder('PATCH', { id: order.id, status: 'CONCLUIDO' })}>
                          Concluir
                        </button>
                      )}
                      {(order.status === 'AGUARDANDO' || order.status === 'EM_ATENDIMENTO') && (
                        <button className="text-button" disabled={busy} onClick={() => void changeOrder('PATCH', { id: order.id, status: 'CANCELADO' })}>
                          Cancelar
                        </button>
                      )}
                      {(order.status === 'CONCLUIDO' || order.status === 'CANCELADO') && '—'}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
      <OrdersStatisticsPanel refreshKey={statisticsRefresh} onSessionExpired={onSessionExpired} />
    </>
  );
}
