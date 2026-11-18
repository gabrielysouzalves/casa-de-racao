'use client';

import type { ReactNode } from 'react';
import { TrendingUp, Wallet, Package, AlertTriangle, Barcode, Plus } from 'lucide-react';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';

type Product = {
  id: string;
  name: string;
  barcode: string | null;
  price: number;
  quantity: number;
  minimum: number;
};

type Movement = {
  id: string;
  product_id: string;
  name: string;
  kind: string;
  quantity: number;
  price: number;
  date: string;
  sale_id: string | null;
  note: string;
};

type Bill = {
  id: string;
  kind: string;
  name: string;
  company: string;
  mei: string;
  date: string;
  amount: number;
  paid: number;
};

type DashboardViewProps = {
  data: { products: Product[]; movements: Movement[]; bills: Bill[] };
  month: string;
  monthly: Movement[];
  income: number;
  monthlyCount: number;
  low: Product[];
  due: Bill[];
  expenses: Bill[];
  onNavigate: (view: string) => void;
  onOpenMovement: () => void;
};

const currency = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n / 100);

const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());

const shortDate = (date: string) => {
  const dateOnly = date.split('T')[0].split(' ')[0];
  const [year, month, day] = dateOnly.split('-');
  return `${day}/${month}/${year}`;
};

function GridTable({ heads, children }: { heads: string[]; children: ReactNode }) {
  return (
    <Table>
      <TableHeader><TableRow>{heads.map((head) => (
        <TableHead key={head}>{head}</TableHead>
      ))}</TableRow></TableHeader>
      <TableBody>{children}</TableBody>
    </Table>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="empty"><Package size={30} /><p>{text}</p></div>;
}

export default function DashboardView({
  data, month, monthly, income, monthlyCount, low, due, expenses,
  onNavigate, onOpenMovement,
}: DashboardViewProps) {
  return (
    <>

                  <div className="metrics">
                    <div className="metric">
                      <span>
                        Vendas no mês
                        <TrendingUp size={20} />
                      </span>
                      <strong>{currency(income)}</strong>
                      <small>
                        {monthlyCount} vendas registradas
                      </small>
                    </div>

                    <div className="metric">
                      <span>
                        Contas em aberto
                        <Wallet size={20} />
                      </span>
                      <strong>
                        {currency(
                          due.reduce((a, b) => a + b.amount, 0)
                        )}
                      </strong>
                      <small>
                        {due.length} registros no mês
                      </small>
                    </div>

                    <div className="metric">
                      <span>
                        Produtos em estoque
                        <Package size={20} />
                      </span>
                      <strong>
                        {data.products.reduce(
                          (a, p) => a + p.quantity,
                          0
                        )}
                        <em> un.</em>
                      </strong>
                      <small>
                        {data.products.length} produtos cadastrados
                      </small>
                    </div>

                    <div className="metric warning">
                      <span>
                        Estoque baixo
                        <AlertTriangle size={20} />
                      </span>
                      <strong>{low.length}</strong>
                      <small>produtos no limite mínimo</small>
                    </div>
                  </div>

                  <div className="dashboard-grid">
                    <section className="panel">
                      <div className="panel-head">
                        <div>
                          <h2>Vendas ao longo do mês</h2>
                          <p>Valor vendido por dia</p>
                        </div>

                        <span className="badge blue">
                          {month.split('-').reverse().join('/')}
                        </span>
                      </div>

                      <div
                        className="chart"
                        role="img"
                        aria-label={`Vendas diárias no mês ${month}. Total ${currency(income)}. ${Array.from(
                          new Set(monthly.map((m) => m.date))
                        )
                          .map(
                            (d) =>
                              `${shortDate(d)}: ${currency(
                                monthly
                                  .filter((m) => m.date === d)
                                  .reduce(
                                    (a, m) =>
                                      a +
                                      Math.abs(m.quantity) * m.price,
                                    0
                                  )
                              )}`
                          )
                          .join('; ')}`}
                      >
                        {Array.from(
                          {
                            length: month
                              ? new Date(
                                  Number(month.slice(0, 4)),
                                  Number(month.slice(5)),
                                  0
                                ).getDate()
                              : 31,
                          },
                          (_, i) => {
                            const day = String(i + 1).padStart(2, '0');

                            const value = monthly
                              .filter(
                                (s) => s.date === `${month}-${day}`
                              )
                              .reduce(
                                (a, s) =>
                                  a + Math.abs(s.quantity) * s.price,
                                0
                              );

                            const max = Math.max(
                              1,
                              ...Array.from({ length: 31 }, (_, j) =>
                                monthly
                                  .filter(
                                    (s) =>
                                      Number(s.date.slice(-2)) === j + 1
                                  )
                                  .reduce(
                                    (a, s) =>
                                      a +
                                      Math.abs(s.quantity) * s.price,
                                    0
                                  )
                              )
                            );

                            return (
                              <div
                                className="chart-column"
                                key={day}
                                title={`${day}: ${currency(value)}`}
                              >
                                <div
                                  className="bar"
                                  style={{
                                    height: `${Math.max(
                                      value ? 4 : 0,
                                      (value / max) * 100
                                    )}%`,
                                  }}
                                />

                                <span>
                                  {i % 5 === 0 ? i + 1 : ''}
                                </span>
                              </div>
                            );
                          }
                        )}
                      </div>

                      <p className="chart-caption">
                        {income
                          ? `Total do período: ${currency(income)}`
                          : 'As vendas aparecerão aqui após o primeiro registro.'}
                      </p>
                    </section>

                    <section className="panel quick">
                      <h2>No balcão</h2>
                      <p>
                        Comece uma venda ou atualize o estoque.
                      </p>

                      <button
                        className="primary"
                        onClick={() => onNavigate('sales')}
                      >
                        <Barcode size={20} />
                        Abrir vendas
                      </button>

                      <button
                        className="secondary"
                        onClick={() => {
                          onNavigate('stock');
                          onOpenMovement();
                        }}
                      >
                        <Plus size={20} />
                        Registrar entrada / saída
                      </button>

                      <div className="quick-total">
                        <span>Gastos por MEI no mês</span>
                        <strong>
                          {currency(
                            expenses.reduce((a, b) => a + b.amount, 0)
                          )}
                        </strong>
                      </div>
                    </section>
                  </div>

                  <div className="dashboard-grid">
                    <section className="panel">
                      <div className="panel-head">
                        <h2>Atenção ao estoque</h2>

                        <button
                          className="text-button"
                          onClick={() => onNavigate('stock')}
                        >
                          Ver estoque
                        </button>
                      </div>

                      {!low.length ? (
                        <Empty text="Nenhum produto abaixo do mínimo." />
                      ) : (
                        <GridTable
                          heads={[
                            'Produto',
                            'Disponível',
                            'Mínimo',
                          ]}
                        >
                          {low.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell>{p.name}</TableCell>

                              <TableCell>
                                <span className="badge amber">
                                  {p.quantity} un.
                                </span>
                              </TableCell>

                              <TableCell>
                                {p.minimum} un.
                              </TableCell>
                            </TableRow>
                          ))}
                        </GridTable>
                      )}
                    </section>

                    <section className="panel">
                      <div className="panel-head">
                        <h2>Próximos pagamentos</h2>
                        <Wallet size={20} />
                      </div>

                      {!data.bills.some((b) => !b.paid) ? (
                        <Empty text="Nenhum pagamento em aberto." />
                      ) : (
                        data.bills
                          .filter((b) => !b.paid)
                          .slice(0, 5)
                          .map((b) => (
                            <div className="due-row" key={b.id}>
                              <div>
                                <b>{b.name}</b>

                                <span
                                  className={
                                    b.kind === 'payment' &&
                                    b.date < today()
                                      ? 'overdue'
                                      : ''
                                  }
                                >
                                  {shortDate(b.date)}
                                  {b.kind === 'payment' &&
                                  b.date < today()
                                    ? ' · Vencido'
                                    : ''}
                                </span>
                              </div>

                              <strong>{currency(b.amount)}</strong>
                            </div>
                          ))
                      )}
                    </section>
                  </div>
                    </>
  );
}
