'use client';

import type { ReactNode } from 'react';
import { Package } from 'lucide-react';
import {
  Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

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

type FinancialViewProps = {
  view: 'payments' | 'mei';
  bills: Bill[];
  month: string;
  mei: string;
  onMeiChange: (value: string) => void;
  busy: boolean;
  onTogglePaid: (bill: Bill) => void;
};

const currency = (n: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(n / 100);

const shortDate = (date: string) => {
  const day = date.split('T')[0].split(' ')[0];
  const [year, month, dayNumber] = day.split('-');
  return `${dayNumber}/${month}/${year}`;
};

const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

function Choice({
  value, onChange, options, label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { id: string; name: string }[];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="choice">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function GridTable({heads, children}: {heads: string[]; children: ReactNode}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {heads.map((head) => <TableHead key={head}>{head}</TableHead>)}
        </TableRow>
      </TableHeader>
      <TableBody>{children}</TableBody>
    </Table>
  );
}

function Empty({text}: {text: string}) {
  return <div className="empty"><Package size={30} /><p>{text}</p></div>;
}

export default function FinancialView({
  view, bills, month, mei, onMeiChange, busy, onTogglePaid,
}: FinancialViewProps) {
  const filteredBills = bills.filter(
    (bill) =>
      bill.kind === (view === 'payments' ? 'payment' : 'expense') &&
      bill.date.startsWith(month) &&
      (view !== 'mei' || mei === 'all' || bill.mei === mei)
  );

  return (
    <>

                  <div className="metrics financial">
                    <div className="metric">
                      <span>Total no período</span>
                      <strong>
                        {currency(
                          filteredBills.reduce(
                            (a, b) => a + b.amount,
                            0
                          )
                        )}
                      </strong>
                    </div>

                    <div className="metric">
                      <span>Pago</span>
                      <strong>
                        {currency(
                          filteredBills
                            .filter((b) => b.paid)
                            .reduce((a, b) => a + b.amount, 0)
                        )}
                      </strong>
                    </div>

                    <div className="metric warning">
                      <span>Em aberto</span>
                      <strong>
                        {currency(
                          filteredBills
                            .filter((b) => !b.paid)
                            .reduce((a, b) => a + b.amount, 0)
                        )}
                      </strong>
                    </div>
                  </div>

                  <section className="panel">
                    <div className="panel-head">
                      <h2>
                        {view === 'payments'
                          ? 'Duplicatas do mês'
                          : 'Compras do mês'}
                      </h2>

                      {view === 'mei' && (
                        <Choice
                          label="Filtrar por MEI"
                          value={mei}
                          onChange={onMeiChange}
                          options={[
                            {
                              id: 'all',
                              name: 'Todos os MEIs',
                            },
                            ...Array.from(
                              new Set(
                                bills
                                  .filter(
                                    (b) => b.kind === 'expense'
                                  )
                                  .map((b) => b.mei)
                              )
                            ).map((m) => ({
                              id: m,
                              name: m,
                            })),
                          ]}
                        />
                      )}
                    </div>

                    {!filteredBills.length ? (
                      <Empty text="Nenhum registro neste período." />
                    ) : (
                      <GridTable
                        heads={
                          view === 'payments'
                            ? [
                                'Duplicata',
                                'Vencimento',
                                'Valor',
                                'Situação',
                                'Ação',
                              ]
                            : [
                                'Compra',
                                'Razão social',
                                'MEI',
                                'Data da compra',
                                'Valor',
                                'Situação',
                                'Ação',
                              ]
                        }
                      >
                        {filteredBills.map((b) => (
                          <TableRow key={b.id}>
                            <TableCell className="product-name">
                              {b.name}
                            </TableCell>

                            {view === 'mei' && (
                              <>
                                <TableCell>{b.company}</TableCell>
                                <TableCell>{b.mei}</TableCell>
                              </>
                            )}

                            <TableCell>{shortDate(b.date)}</TableCell>

                            <TableCell>{currency(b.amount)}</TableCell>

                            <TableCell>
                              <span
                                className={`badge ${
                                  b.paid
                                    ? 'green'
                                    : b.kind === 'payment' &&
                                        b.date < today()
                                      ? 'red'
                                      : 'amber'
                                }`}
                              >
                                {b.paid
                                  ? 'Pago'
                                  : b.kind === 'payment' &&
                                      b.date < today()
                                    ? 'Vencido'
                                    : 'Em aberto'}
                              </span>
                            </TableCell>

                            <TableCell>
                              <button
                                className="text-button"
                                disabled={busy}
                                onClick={() => onTogglePaid(b)}
                              >
                                {b.paid
                                  ? 'Marcar em aberto'
                                  : 'Marcar pago'}
                              </button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </GridTable>
                    )}
                  </section>

    </>
  );
}
