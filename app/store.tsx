'use client';

import { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Package,
  Barcode,
  Wallet,
  Building2,
  Plus,
  TrendingUp,
  AlertTriangle,
  Search,
  Users,
} from 'lucide-react';

import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { Checkbox } from '@/components/ui/checkbox';
import { Toaster, toast } from 'sonner';
import type { PublicUser } from '@/lib/auth';
import UsersPanel from '@/components/users-panel';
import StoreSidebar from '@/components/store/StoreSidebar';
import StockView from '@/components/store/StockView';
import SalesView from '@/components/store/SalesView';
import FinancialView from '@/components/store/FinancialView';

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

type Data = {
  products: Product[];
  movements: Movement[];
  bills: Bill[];
};

const currency = (n: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(n / 100);

const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const shortDate = (d: string) => d.split('-').reverse().join('/');

const nav = [
  { id: 'dashboard', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'stock', label: 'Estoque', icon: Package },
  { id: 'sales', label: 'Vendas', icon: Barcode },
  { id: 'payments', label: 'Contas a pagar', icon: Wallet },
  { id: 'mei', label: 'Gastos por MEI', icon: Building2 },
];

function Choice({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string }[];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="choice">
        <SelectValue placeholder={label} />
      </SelectTrigger>

      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function GridTable({
  heads,
  children,
}: {
  heads: string[];
  children: React.ReactNode;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {heads.map((h) => (
            <TableHead key={h}>{h}</TableHead>
          ))}
        </TableRow>
      </TableHeader>

      <TableBody>{children}</TableBody>
    </Table>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <Package size={30} />
      <p>{text}</p>
    </div>
  );
}

export default function Store({
  user,
  onLogout,
  onPasswordChange,
  onSessionExpired,
}: {
  user: PublicUser;
  onLogout: () => void;
  onPasswordChange: () => void;
  onSessionExpired: () => void;
}) {
  const menus =
    user.role === 'admin'
      ? [...nav, { id: 'users', label: 'Usuários', icon: Users }]
      : nav;

  const [view, setView] = useState('dashboard');

  const [data, setData] = useState<Data>({
    products: [],
    movements: [],
    bills: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState('');
  const [edit, setEdit] = useState<Product | null>(null);
  const [selected, setSelected] = useState('');
  const [direction, setDirection] = useState('in');
  const [formPaid, setFormPaid] = useState(false);
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState(today().slice(0, 7));
  const [mei, setMei] = useState('all');
  const [code, setCode] = useState('');

  const [cart, setCart] = useState<
    { productId: string; quantity: number }[]
  >([]);

  const [saleDate, setSaleDate] = useState(today());

  const scan = useRef<HTMLInputElement>(null);
  const saving = useRef(false);

  async function load() {
    try {
      const r = await fetch('/api/data', {
        cache: 'no-store',
      });

      const d = (await r.json()) as Data & { error?: string };

      if (r.status === 401) {
        onSessionExpired();
        return;
      }

      if (!r.ok) {
        throw new Error(d.error);
      }

      setData(d);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Carregamento inicial dos dados
  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/data', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (r) => {
        const d = (await r.json()) as Data & { error?: string };

        if (r.status === 401) {
          onSessionExpired();
          return null;
        }

        if (!r.ok) {
          throw new Error(d.error);
        }

        return d;
      })
      .then((d) => {
        if (d) {
          setData(d);
          setError('');
        }
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) {
          setError((e as Error).message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [onSessionExpired]);

  // Foco automático no campo de código de barras
  useEffect(() => {
    if (view === 'sales') {
      scan.current?.focus();
    }
  }, [view]);

  // Disponibiliza a consulta resumida da loja
  useEffect(() => {
    const context = (
      document as unknown as {
        modelContext?: {
          registerTool: (
            t: unknown,
            o: unknown
          ) => Promise<void>;
        };
      }
    ).modelContext;

    if (!context) return;

    const c = new AbortController();

    Promise.resolve(
      context.registerTool(
        {
          name: 'read_store_summary',
          description:
            'Consulta produtos, estoque e registros financeiros da loja.',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
          annotations: {
            readOnlyHint: true,
          },
          execute: async (input: unknown) => {
            if (
              !input ||
              typeof input !== 'object' ||
              Object.keys(input).length
            ) {
              throw new Error('Informe um objeto vazio');
            }

            const r = await fetch('/api/data');

            if (!r.ok) {
              throw new Error('Dados indisponíveis');
            }

            const d = (await r.json()) as Data & {
              error?: string;
            };

            setData(d);

            return {
              products: d.products.length,
              units: d.products.reduce(
                (a: number, p: Product) => a + p.quantity,
                0
              ),
              openBills: d.bills.filter((b: Bill) => !b.paid).length,
            };
          },
        },
        { signal: c.signal }
      )
    ).catch(() => {});

    return () => c.abort();
  }, []);

  async function save(payload: unknown) {
    if (saving.current) return false;

    saving.current = true;
    setBusy(true);

    try {
      const r = await fetch('/api/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const d = (await r.json()) as Data & {
        error?: string;
      };

      if (!r.ok) {
        throw new Error(d.error);
      }

      await load();

      toast.success('Registro salvo');

      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    } finally {
      setBusy(false);
      saving.current = false;
    }
  }

  function open(kind: string, p?: Product) {
    setEdit(p || null);
    setSelected(p?.id || data.products[0]?.id || '');
    setDirection('in');
    setFormPaid(false);
    setModal(kind);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const f = new FormData(e.currentTarget);

    const s = (k: string) => String(f.get(k) || '');
    const n = (k: string) => Number(s(k));
    const amount = (k: string) => Math.round(n(k) * 100);

    let payload: unknown;

    if (modal === 'product') {
      payload = {
        action: 'product',
        ...(edit ? { id: edit.id } : {}),
        name: s('name'),
        barcode: s('barcode'),
        price: amount('price'),
        minimum: n('minimum'),
      };
    } else if (modal === 'movement') {
      payload = {
        action: 'movement',
        productId: selected,
        kind: direction,
        quantity: n('quantity'),
        date: s('date'),
        note: s('note'),
      };
    } else {
      payload = {
        action: 'bill',
        kind: modal === 'payment' ? 'payment' : 'expense',
        name: s('name'),
        company: s('company'),
        mei: s('mei'),
        date: s('date'),
        amount: amount('amount'),
        paid: formPaid,
      };
    }

    if (await save(payload)) {
      setModal('');
    }
  }

  function add(p: Product) {
    if (saving.current) {
      toast.error('Aguarde a finalização da venda');
      return;
    }

    const current =
      cart.find((i) => i.productId === p.id)?.quantity || 0;

    if (current >= p.quantity) {
      toast.error('Quantidade acima do estoque disponível');
      return;
    }

    setCart((c) =>
      c.some((i) => i.productId === p.id)
        ? c.map((i) =>
            i.productId === p.id
              ? { ...i, quantity: i.quantity + 1 }
              : i
          )
        : [...c, { productId: p.id, quantity: 1 }]
    );

    setCode('');
    scan.current?.focus();
  }

  function readCode(e: React.FormEvent) {
    e.preventDefault();

    const p = data.products.find(
      (p) => p.barcode === code.trim()
    );

    if (!p) {
      toast.error(
        'Código não cadastrado. Cadastre o produto no estoque.'
      );
      scan.current?.select();
      return;
    }

    add(p);
  }

  const sales = data.movements.filter((m) => m.kind === 'sale');

  const monthly = sales.filter((m) =>
    m.date.startsWith(month)
  );

  const income = monthly.reduce(
    (a, m) => a + Math.abs(m.quantity) * m.price,
    0
  );

  const low = data.products.filter(
    (p) => p.quantity <= p.minimum
  );

  const due = data.bills.filter(
    (b) => !b.paid && b.date.startsWith(month)
  );

  const expenses = data.bills.filter(
    (b) =>
      b.kind === 'expense' &&
      b.date.startsWith(month)
  );

  const cartTotal = cart.reduce(
    (a, i) =>
      a +
      (data.products.find((p) => p.id === i.productId)?.price || 0) *
        i.quantity,
    0
  );

  const products = data.products.filter((p) =>
    [p.name, p.barcode || ''].some((v) =>
      v.toLowerCase().includes(search.toLowerCase())
    )
  );

  const monthlyCount = new Set(
    monthly.map((m) => m.sale_id)
  ).size;

  return (
    <SidebarProvider>
      <Toaster richColors position="top-right" />

      <StoreSidebar
          user={user}
          view={view}
          onNavigate={(selectedView) => {
            setView(selectedView);
            setSearch('');
          }}
          onLogout={onLogout}
          onPasswordChange={onPasswordChange}
        />


      <SidebarInset className="workspace">
        <header className="topbar">
          <div className="top-left">
            <SidebarTrigger />
            <span>Painel da loja</span>
          </div>

          <span className="date-top">
            {new Intl.DateTimeFormat('pt-BR', {
              timeZone: 'America/Sao_Paulo',
              dateStyle: 'long',
            }).format(new Date())}
          </span>
        </header>

        <main className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {view === 'dashboard'
                  ? 'ACOMPANHAMENTO'
                  : 'GESTÃO'}
              </p>

              <h1>
                {menus.find((n) => n.id === view)?.label}
              </h1>

              <p className="subheading">
                {view === 'dashboard'
                  ? 'Tudo o que você precisa acompanhar no dia a dia.'
                  : view === 'stock'
                    ? 'Produtos, quantidades e movimentações.'
                    : view === 'sales'
                      ? 'Seu balcão de vendas, pronto para o leitor.'
                      : view === 'payments'
                        ? 'Duplicatas e vencimentos organizados.'
                        : view === 'users'
                          ? 'Cadastre e gerencie os acessos da equipe.'
                          : 'Compras e pagamentos de cada MEI.'}
              </p>
            </div>

            <div className="heading-actions">
              {['dashboard', 'payments', 'mei'].includes(view) && (
                <label className="month-label">
                  Mês de referência
                  <input
                    aria-label="Mês de referência"
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                  />
                </label>
              )}

              {view === 'stock' && (
                <button
                  className="primary"
                  onClick={() => open('product')}
                >
                  <Plus size={18} />
                  Novo produto
                </button>
              )}

              {view === 'payments' && (
                <button
                  className="primary"
                  onClick={() => open('payment')}
                >
                  <Plus size={18} />
                  Nova duplicata
                </button>
              )}

              {view === 'mei' && (
                <button
                  className="primary"
                  onClick={() => open('expense')}
                >
                  <Plus size={18} />
                  Registrar gasto
                </button>
              )}
            </div>
          </div>

          {error ? (
            <div className="error" role="alert">
              {error}
              <button onClick={load}>Tentar novamente</button>
            </div>
          ) : loading ? (
            <div className="panel empty" role="status">
              Carregando os registros da loja…
            </div>
          ) : (
            <>
              {view === 'users' && user.role === 'admin' && (
                <UsersPanel currentUserId={user.id} />
              )}

              {view === 'dashboard' && (
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
                        onClick={() => setView('sales')}
                      >
                        <Barcode size={20} />
                        Abrir vendas
                      </button>

                      <button
                        className="secondary"
                        onClick={() => {
                          setView('stock');
                          open('movement');
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
                          onClick={() => setView('stock')}
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
              )}

              {view === 'stock' && (
                <StockView
                  products={products}
                  movements={data.movements}
                  search={search}
                  onSearchChange={setSearch}
                  onOpenMovement={() => open('movement')}
                  onEditProduct={(product) => open('product', product)}
                />
              )}

              {view === 'sales' && (
                <SalesView
                  products={products}
                  allProducts={data.products}
                  monthly={monthly}
                  cart={cart}
                  cartTotal={cartTotal}
                  busy={busy}
                  search={search}
                  setSearch={setSearch}
                  code={code}
                  setCode={setCode}
                  month={month}
                  setMonth={setMonth}
                  saleDate={saleDate}
                  setSaleDate={setSaleDate}
                  scan={scan}
                  readCode={readCode}
                  add={add}
                  setCart={setCart}
                  save={save}
                />
              )}

              {['payments', 'mei'].includes(view) && (
                <FinancialView
                  view={view as 'payments' | 'mei'}
                  bills={data.bills}
                  month={month}
                  mei={mei}
                  onMeiChange={setMei}
                  busy={busy}
                  onTogglePaid={(bill) => {
                    void save({
                      action: 'paid',
                      id: bill.id,
                      paid: !bill.paid,
                    });
                  }}
                />
              )}
            </>
          )}
        </main>
      </SidebarInset>

      <Dialog
        open={!!modal}
        onOpenChange={(v) => {
          if (!v && !busy) {
            setModal('');
          }
        }}
      >
        <DialogContent className="store-dialog">
          <DialogHeader>
            <DialogTitle>
              {modal === 'product'
                ? edit
                  ? 'Editar produto'
                  : 'Novo produto'
                : modal === 'movement'
                  ? 'Movimentar estoque'
                  : modal === 'payment'
                    ? 'Nova duplicata'
                    : 'Registrar gasto por MEI'}
            </DialogTitle>

            <DialogDescription>
              {modal === 'product'
                ? 'Após cadastrar, registre uma entrada para adicionar quantidades.'
                : modal === 'movement'
                  ? 'Entradas e saídas ficam salvas no histórico.'
                  : 'Preencha os dados para acompanhar o pagamento.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="form-grid">
            {modal === 'product' ? (
              <>
                <label>
                  Nome do produto
                  <input
                    name="name"
                    required
                    maxLength={180}
                    defaultValue={edit?.name}
                  />
                </label>

                <label>
                  Código de barras
                  <input
                    name="barcode"
                    maxLength={80}
                    defaultValue={edit?.barcode || ''}
                  />
                </label>

                <div className="two-fields">
                  <label>
                    Preço de venda (R$)
                    <input
                      name="price"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      defaultValue={
                        edit ? edit.price / 100 : ''
                      }
                    />
                  </label>

                  <label>
                    Estoque mínimo
                    <input
                      name="minimum"
                      type="number"
                      min="0"
                      step="1"
                      required
                      defaultValue={edit?.minimum ?? 5}
                    />
                  </label>
                </div>
              </>
            ) : modal === 'movement' ? (
              <>
                <label>
                  Produto
                  <Choice
                    label="Selecione um produto"
                    value={selected}
                    onChange={setSelected}
                    options={data.products.map((p) => ({
                      id: p.id,
                      name: p.name,
                    }))}
                  />
                </label>

                {!data.products.length && (
                  <p>
                    Cadastre um produto antes de movimentar o estoque.
                  </p>
                )}

                <label>
                  Movimento
                  <Choice
                    label="Movimento"
                    value={direction}
                    onChange={setDirection}
                    options={[
                      { id: 'in', name: 'Entrada' },
                      { id: 'out', name: 'Saída' },
                    ]}
                  />
                </label>

                <div className="two-fields">
                  <label>
                    Quantidade
                    <input
                      name="quantity"
                      type="number"
                      required
                      min="1"
                      step="1"
                    />
                  </label>

                  <label>
                    Data
                    <input
                      name="date"
                      type="date"
                      required
                      defaultValue={today()}
                    />
                  </label>
                </div>

                <label>
                  Observação
                  <input
                    name="note"
                    maxLength={180}
                    placeholder="Ex.: compra de fornecedor, perda ou ajuste"
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  {modal === 'payment'
                    ? 'Nome da duplicata'
                    : 'Descrição da compra'}

                  <input
                    name="name"
                    required
                    maxLength={180}
                  />
                </label>

                {modal === 'expense' && (
                  <>
                    <label>
                      Razão social
                      <input
                        name="company"
                        required
                        maxLength={180}
                      />
                    </label>

                    <label>
                      Nome do MEI
                      <input
                        name="mei"
                        required
                        maxLength={180}
                      />
                    </label>
                  </>
                )}

                <div className="two-fields">
                  <label>
                    {modal === 'payment'
                      ? 'Data de vencimento'
                      : 'Data da compra'}

                    <input
                      name="date"
                      type="date"
                      required
                      defaultValue={today()}
                    />
                  </label>

                  <label>
                    Valor (R$)
                    <input
                      name="amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                    />
                  </label>
                </div>

                <label className="checkbox-label">
                  <Checkbox
                    checked={formPaid}
                    onCheckedChange={(v) =>
                      setFormPaid(v === true)
                    }
                  />
                  Já foi pago
                </label>
              </>
            )}

            <button
              className="primary"
              disabled={busy || (modal === 'movement' && !selected)}
            >
              {busy ? 'Salvando…' : 'Salvar registro'}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}