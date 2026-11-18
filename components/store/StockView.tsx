'use client';

import type { ReactNode } from 'react';
import { Search, Package } from 'lucide-react';

import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';

// Tipos de dados

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

// Propriedades recebidas do componente principal

type StockViewProps = {
  products: Product[];
  movements: Movement[];
  search: string;
  onSearchChange: (value: string) => void;
  onOpenMovement: () => void;
  onEditProduct: (product: Product) => void;
};

// Funções auxiliares

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

// Componentes auxiliares

function GridTable({
  heads,
  children,
}: {
  heads: string[];
  children: ReactNode;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {heads.map((head) => (
            <TableHead key={head}>{head}</TableHead>
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

// Componente principal de Estoque

export default function StockView({
  products,
  movements,
  search,
  onSearchChange,
  onOpenMovement,
  onEditProduct,
}: StockViewProps) {
  return (
    <>
      {/* Lista de produtos */}

      <section className="panel">
        <div className="panel-head">
          <div className="search">
            <Search size={18} />

            <input
              aria-label="Buscar produto ou código"
              placeholder="Buscar produto ou código de barras"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>

          <button
            className="secondary"
            onClick={onOpenMovement}
          >
            Entrada / saída
          </button>
        </div>

        {!products.length ? (
          <Empty
            text={
              search
                ? 'Nenhum produto encontrado.'
                : 'Cadastre o primeiro produto para começar.'
            }
          />
        ) : (
          <GridTable
            heads={[
              'Produto',
              'Código de barras',
              'Preço de venda',
              'Quantidade',
              'Situação',
              '',
            ]}
          >
            {products.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="product-name">
                  {p.name}
                </TableCell>

                <TableCell className="code">
                  {p.barcode || 'Sem código'}
                </TableCell>

                <TableCell>{currency(p.price)}</TableCell>

                <TableCell>{p.quantity} un.</TableCell>

                <TableCell>
                  <span
                    className={`badge ${
                      p.quantity <= p.minimum
                        ? 'amber'
                        : 'green'
                    }`}
                  >
                    {p.quantity <= p.minimum
                      ? 'Estoque baixo'
                      : 'Disponível'}
                  </span>
                </TableCell>

                <TableCell>
                  <button
                    className="text-button"
                    onClick={() => onEditProduct(p)}
                  >
                    Editar
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </GridTable>
        )}
      </section>

      {/* Histórico de movimentações */}

      <section className="panel">
        <div className="panel-head">
          <h2>Histórico de movimentações</h2>
        </div>

        {!movements.length ? (
          <Empty text="As entradas e saídas serão registradas aqui." />
        ) : (
          <GridTable
            heads={[
              'Data',
              'Produto',
              'Movimento',
              'Quantidade',
              'Observação',
            ]}
          >
            {movements.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  {shortDate(m.date)}
                </TableCell>

                <TableCell>{m.name}</TableCell>

                <TableCell>
                  <span
                    className={`badge ${
                      m.kind === 'in'
                        ? 'green'
                        : 'blue'
                    }`}
                  >
                    {m.kind === 'in'
                      ? 'Entrada'
                      : m.kind === 'sale'
                        ? 'Venda'
                        : 'Saída'}
                  </span>
                </TableCell>

                <TableCell>
                  {m.quantity > 0 ? '+' : ''}
                  {m.quantity}
                </TableCell>

                <TableCell>
                  {m.note || '—'}
                </TableCell>
              </TableRow>
            ))}
          </GridTable>
        )}
      </section>
    </>
  );
}