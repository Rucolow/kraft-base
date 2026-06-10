import { useQuery } from '@powersync/react';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackButton, EmptyState, PrimaryButton, Screen, SectionLabel } from '../components/ui';
import { nowIso } from '../lib/date';
import { deleteRow, insertRow, updateRow, uuid } from '../lib/db';
import type { ProductRow } from '../lib/powersync/schema';
import { useSession } from '../lib/session';

const yen = (value: number | null) => `${(value ?? 0).toLocaleString('en-US')}円`;

export function Products() {
  const navigate = useNavigate();
  const { isOwner } = useSession();
  const { data: products } = useQuery<ProductRow>('SELECT * FROM product ORDER BY sort, name');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [sell, setSell] = useState('');
  const [cost, setCost] = useState('');

  async function add() {
    if (!name.trim()) {
      return;
    }
    await insertRow('product', {
      id: uuid(),
      name: name.trim(),
      sell_price: Number.parseInt(sell, 10) || 0,
      cost: Number.parseInt(cost, 10) || 0,
      sort: products.length,
      created_at: nowIso(),
    });
    setName('');
    setSell('');
    setCost('');
  }

  const numCls =
    'min-h-[40px] w-20 rounded-[8px] border border-line bg-cream px-2 py-1 text-right text-base text-ink outline-none focus:border-orange-light tabular-nums';

  return (
    <Screen>
      <BackButton onClick={() => navigate('/manual')}>辞書</BackButton>
      <div className="flex items-center justify-between">
        <SectionLabel>商品一覧（館内販売）</SectionLabel>
        {isOwner ? (
          <button
            type="button"
            onClick={() => setEditing((prev) => !prev)}
            className={`flex min-h-[40px] items-center gap-1 rounded-full border px-3 font-bold text-[0.78rem] ${editing ? 'border-orange bg-orange/15 text-orange' : 'border-line text-ink-light'}`}
          >
            {editing ? <Check size={14} /> : <Pencil size={14} />}
            {editing ? '完了' : '編集'}
          </button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-kb border border-line">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 border-line border-b bg-cream px-3 py-2.5 font-bold text-[0.78rem] text-ink-light">
          <span>商品</span>
          <span className="w-20 text-right">売価</span>
          <span className="w-20 text-right">原価</span>
          <span className="w-20 text-right">粗利</span>
        </div>
        {products.length === 0 ? (
          <EmptyState>商品がありません。</EmptyState>
        ) : (
          products.map((product) => {
            const margin = (product.sell_price ?? 0) - (product.cost ?? 0);
            return (
              <div
                key={product.id}
                className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 border-line border-b px-3 py-2.5 text-[0.92rem] last:border-none"
              >
                <span className="truncate">{product.name}</span>
                {editing ? (
                  <>
                    <input
                      type="number"
                      inputMode="numeric"
                      className={numCls}
                      value={String(product.sell_price ?? 0)}
                      onChange={(event) =>
                        updateRow('product', product.id, {
                          sell_price: Number.parseInt(event.target.value, 10) || 0,
                        })
                      }
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      className={numCls}
                      value={String(product.cost ?? 0)}
                      onChange={(event) =>
                        updateRow('product', product.id, {
                          cost: Number.parseInt(event.target.value, 10) || 0,
                        })
                      }
                    />
                    <button
                      type="button"
                      aria-label={`${product.name}を削除`}
                      onClick={() => deleteRow('product', product.id)}
                      className="grid h-9 w-20 place-items-center text-ink-mute"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="w-20 text-right tabular-nums">{yen(product.sell_price)}</span>
                    <span className="w-20 text-right text-ink-light tabular-nums">
                      {yen(product.cost)}
                    </span>
                    <span className="w-20 text-right font-bold text-orange tabular-nums">
                      {yen(margin)}
                    </span>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {isOwner && editing ? (
        <div className="mt-4">
          <SectionLabel>商品を追加</SectionLabel>
          <div className="flex flex-wrap items-end gap-2">
            <input
              className="min-h-[48px] flex-1 rounded-[11px] border border-line bg-cream px-3 py-3 text-base text-ink outline-none focus:border-orange-light"
              placeholder="商品名"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <input
              type="number"
              inputMode="numeric"
              className={numCls}
              placeholder="売価"
              value={sell}
              onChange={(event) => setSell(event.target.value)}
            />
            <input
              type="number"
              inputMode="numeric"
              className={numCls}
              placeholder="原価"
              value={cost}
              onChange={(event) => setCost(event.target.value)}
            />
            <button
              type="button"
              aria-label="追加"
              onClick={add}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-[11px] bg-orange text-ondark"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>
      ) : null}

      {!isOwner ? (
        <div className="mt-3 px-1 text-[0.76rem] text-ink-mute">価格の編集はオーナーのみ。</div>
      ) : null}

      <div className="mt-6">
        <PrimaryButton onClick={() => navigate('/manual/c/proc-payment')}>
          決済の使い方を見る
        </PrimaryButton>
      </div>
    </Screen>
  );
}
