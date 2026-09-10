'use client';
import { useState } from 'react';
import { MENU_CATEGORIES } from '@/lib/menuCategories';

export default function MenuTabs({ items, ordersOpen }) {
  const [cat, setCat] = useState('snack');
  const filtered = items.filter((item) => (item.category || 'snack') === cat);

  return (
    <div className="bg-white border-2 border-gray-100 rounded-3xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="icon-badge icon-badge-mint w-7 h-7 rounded-lg text-sm">🍪</div>
          <div className="font-display text-base text-navy">금청수 상점</div>
        </div>
        <span
          className={`text-[11px] font-bold px-2 py-1 rounded-full ${
            ordersOpen ? 'bg-mint/15 text-mint-deep' : 'bg-gray-100 text-gray-400'
          }`}
        >
          {ordersOpen ? '주문 가능' : '주문 마감'}
        </span>
      </div>

      {items.length === 0 && <p className="text-xs text-gray-400 py-4 text-center">등록된 메뉴가 없어요.</p>}

      {items.length > 0 && (
        <>
          <div className="flex gap-1.5 overflow-x-auto pb-1 mb-1 -mx-1 px-1">
            {MENU_CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => setCat(c.key)}
                className={`whitespace-nowrap text-xs px-3 py-1.5 rounded-full border-[1.5px] flex items-center gap-1 ${
                  cat === c.key ? 'bg-navy border-navy text-white' : 'border-gray-200 text-gray-500'
                }`}
              >
                <span>{c.icon}</span>
                {c.label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">이 소분류엔 메뉴가 없어요.</p>
          ) : (
            filtered.map((item) => {
              const soldOut = item.stock !== null && item.stock <= 0;
              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between py-2.5 border-b border-dashed border-gray-200 last:border-0 ${soldOut ? 'opacity-40' : ''}`}
                >
                  <div>
                    <div className="font-bold text-sm">{item.name}</div>
                    {item.description && <div className="text-[11px] text-gray-400">{item.description}</div>}
                    {item.stock !== null && !soldOut && (
                      <div className="text-[11px] text-gray-400">재고 {item.stock}개</div>
                    )}
                  </div>
                  {soldOut ? (
                    <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-400">품절</span>
                  ) : (
                    <div className="text-xs text-gold-deep font-bold">{item.price} GC</div>
                  )}
                </div>
              );
            })
          )}

          <p className="text-xs text-gray-400 mt-2">
            {ordersOpen ? '로그인하면 코인으로 바로 주문할 수 있어요.' : '지금은 주문을 받지 않고 있어요.'}
          </p>
        </>
      )}
    </div>
  );
}
