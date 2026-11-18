'use client';

import type { FormEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

type Product = {
  id: string;
  name: string;
  barcode: string | null;
  price: number;
  quantity: number;
  minimum: number;
};

type StoreDialogProps = {
  modal: string;
  edit: Product | null;
  busy: boolean;
  selected: string;
  direction: string;
  formPaid: boolean;
  products: Product[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  setSelected: (value: string) => void;
  setDirection: (value: string) => void;
  setFormPaid: (value: boolean) => void;
};

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

export default function StoreDialog({
  modal,
  edit,
  busy,
  selected,
  direction,
  formPaid,
  products,
  onOpenChange,
  onSubmit,
  setSelected,
  setDirection,
  setFormPaid,
}: StoreDialogProps) {
  return (
      <Dialog
        open={!!modal}
        onOpenChange={onOpenChange}
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

          <form onSubmit={onSubmit} className="form-grid">
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
                    options={products.map((p) => ({
                      id: p.id,
                      name: p.name,
                    }))}
                  />
                </label>

                {!products.length && (
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
  );
}
