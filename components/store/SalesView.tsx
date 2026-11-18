'use client';

import type { Dispatch, FormEvent, ReactNode, RefObject, SetStateAction } from 'react';
import { Barcode, Check, Package, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

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

type CartItem = { productId: string; quantity: number };

type SalesViewProps = {
  products: Product[];
  allProducts: Product[];
  monthly: Movement[];
  cart: CartItem[];
  cartTotal: number;
  busy: boolean;
  search: string;
  setSearch: (search: string) => void;
  code: string;
  setCode: (code: string) => void;
  month: string;
  setMonth: (month: string) => void;
  saleDate: string;
  setSaleDate: (date: string) => void;
  scan: RefObject<HTMLInputElement | null>;
  readCode: (event: FormEvent) => void;
  add: (product: Product) => void;
  setCart: Dispatch<SetStateAction<CartItem[]>>;
  save: (payload: unknown) => Promise<boolean>;
};

const currency = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n / 100);

const shortDate = (date: string) => {
  const value = date.split('T')[0].split(' ')[0];
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
};

function GridTable({ heads, children }: { heads: string[]; children: ReactNode }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>{heads.map((head) => <TableHead key={head}>{head}</TableHead>)}</TableRow>
      </TableHeader>
      <TableBody>{children}</TableBody>
    </Table>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="empty"><Package size={30} /><p>{text}</p></div>;
}

export default function SalesView({
  products, allProducts, monthly, cart, cartTotal, busy,
  search, setSearch, code, setCode, month, setMonth,
  saleDate, setSaleDate, scan, readCode, add, setCart, save,
}: SalesViewProps) {
  return (
    <>
    <div className="sales-layout">
      <section className="panel">
        <div className="panel-head">
          <h2>
            <Barcode size={21} />
            Adicionar produtos
          </h2>
        </div>

        <form
          onSubmit={readCode}
          className="scan-form"
        >
          <label htmlFor="barcode">
            Código de barras
          </label>

          <div>
            <input
              ref={scan}
              id="barcode"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Leia o código ou digite e pressione Enter"
              autoComplete="off"
            />

            <button
              className="primary"
              disabled={!code.trim()}
            >
              Adicionar
            </button>
          </div>

          <p>
            Configure o leitor para enviar Enter após cada
            leitura.
          </p>
        </form>

        <div className="search">
          <Search size={18} />

          <input
            aria-label="Buscar produto para vender"
            placeholder="Ou encontre pelo nome"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="product-picker">
          {products.map((p) => (
            <button
              disabled={!p.quantity || busy}
              key={p.id}
              onClick={() => add(p)}
            >
              <span>
                <b>{p.name}</b>
                <small>
                  {p.quantity} un. disponíveis
                </small>
              </span>

              <strong>{currency(p.price)}</strong>
              <Plus size={18} />
            </button>
          ))}

          {!products.length && (
            <Empty text="Cadastre produtos e registre uma entrada no estoque." />
          )}
        </div>
      </section>

      <section className="panel cart">
        <div className="panel-head">
          <h2>
            <ShoppingCart size={21} />
            Venda atual
          </h2>

          <span className="badge blue">
            {cart.reduce(
              (a, i) => a + i.quantity,
              0
            )}{' '}
            itens
          </span>
        </div>

        <label>
          Data da venda
          <input
            type="date"
            value={saleDate}
            onChange={(e) => setSaleDate(e.target.value)}
          />
        </label>

        {!cart.length ? (
          <Empty text="Leia um código para iniciar uma venda." />
        ) : (
          cart.map((i) => {
            const p = allProducts.find(
              (p) => p.id === i.productId
            )!;

            return (
              <div
                className="cart-row"
                key={i.productId}
              >
                <div>
                  <b>{p.name}</b>
                  <small>
                    {currency(p.price)} / un.
                  </small>
                </div>

                <input
                  aria-label={`Quantidade de ${p.name}`}
                  type="number"
                  min="1"
                  max={p.quantity}
                  value={i.quantity}
                  disabled={busy}
                  onChange={(e) => {
                    const q = Number(e.target.value);

                    if (
                      Number.isInteger(q) &&
                      q > 0 &&
                      q <= p.quantity
                    ) {
                      setCart((c) =>
                        c.map((item) =>
                          item.productId === p.id
                            ? { ...item, quantity: q }
                            : item
                        )
                      );
                    }
                  }}
                />

                <button
                  disabled={busy}
                  aria-label={`Remover ${p.name}`}
                  onClick={() =>
                    setCart((c) =>
                      c.filter(
                        (item) =>
                          item.productId !== p.id
                      )
                    )
                  }
                >
                  <Trash2 size={17} />
                </button>
              </div>
            );
          })
        )}

        <div className="cart-bottom">
          <span>
            Total da venda
            <strong>{currency(cartTotal)}</strong>
          </span>

          <button
            className="primary"
            disabled={!cart.length || busy || !saleDate}
            onClick={async () => {
              if (
                await save({
                  action: 'sale',
                  date: saleDate,
                  items: cart,
                })
              ) {
                setCart([]);
                scan.current?.focus();
              }
            }}
          >
            <Check size={18} />
            {busy ? 'Registrando…' : 'Finalizar venda'}
          </button>

          <p>
            A finalização atualiza o estoque automaticamente.
          </p>
        </div>
      </section>
    </div>

    <section className="panel">
      <div className="panel-head">
        <h2>Histórico de vendas</h2>

        <label className="month-label">
          Mês
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
      </div>

      {!monthly.length ? (
        <Empty text="Nenhuma venda registrada neste mês." />
      ) : (
        <GridTable
          heads={[
            'Data',
            'Venda',
            'Produto',
            'Quantidade',
            'Valor unitário',
            'Total',
          ]}
        >
          {monthly.map((m) => (
            <TableRow key={m.id}>
              <TableCell>{shortDate(m.date)}</TableCell>

              <TableCell className="code">
                {m.sale_id?.slice(0, 8)}
              </TableCell>

              <TableCell>{m.name}</TableCell>

              <TableCell>
                {Math.abs(m.quantity)}
              </TableCell>

              <TableCell>{currency(m.price)}</TableCell>

              <TableCell>
                {currency(
                  Math.abs(m.quantity) * m.price
                )}
              </TableCell>
            </TableRow>
          ))}
        </GridTable>
      )}
    </section>
    </>
  );
}
