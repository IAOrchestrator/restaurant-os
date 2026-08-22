type Dish = { id: string; name: string; desc: string; price: number; img: string; badge?: string; cat: string };
type Cart = { dish: Dish; qty: number };

export function TableWorkspace({ dishes, cart, onAdd, onCallWaiter, onRequestBill, onSend }: {
  dishes: Dish[];
  cart: Cart[];
  onAdd: (d: Dish) => void;
  onCallWaiter: () => void;
  onRequestBill: () => void;
  onSend: () => void;
}) {
  const cats = [...new Set(dishes.map(d=>d.cat))];
  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar categorías */}
      <aside className="w-[220px] glass border-r border-white/5 p-4 hidden lg:block">
        <div className="text-[11px] uppercase tracking-widest text-text-tertiary mb-4">Menú</div>
        <div className="space-y-1">
          {cats.map(c=>(
            <div key={c} className="h-10 px-3 rounded-sm flex items-center text-sm text-text-secondary hover:bg-white/5 cursor-pointer">{c}</div>
          ))}
        </div>
        <div className="mt-8 space-y-2">
          <button onClick={onCallWaiter} className="w-full h-11 rounded-sm glass border border-white/10 text-sm">🔔 Llamar al Mozo</button>
          <button onClick={onRequestBill} className="w-full h-11 rounded-sm border border-white/10 text-sm text-text-secondary">🧾 Pedir Cuenta</button>
        </div>
      </aside>

      {/* Grid menú */}
      <main className="flex-1 p-4 lg:p-6">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {dishes.map(d=>(
            <div key={d.id} className="group glass rounded-md overflow-hidden hover:shadow-glass transition">
              <div className="aspect-[16/9] bg-surface-2 relative">
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                {d.badge && <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-pill bg-amber text-black font-bold">{d.badge}</span>}
                <div className="absolute inset-0 flex items-center justify-center text-text-tertiary text-xs">{d.img ? "Foto" : "🍽️"}</div>
              </div>
              <div className="p-3">
                <div className="flex justify-between gap-2">
                  <h4 className="text-[15px] font-semibold leading-tight">{d.name}</h4>
                  <span className="text-mono text-amber text-[13px]">${d.price}</span>
                </div>
                <p className="text-[12px] text-text-secondary line-clamp-2 mt-1">{d.desc}</p>
                <button onClick={()=>onAdd(d)} className="mt-3 w-full h-9 rounded-sm bg-surface-2 group-hover:bg-amber group-hover:text-black text-sm font-medium transition">+ Agregar</button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Carrito lateral */}
      <aside className="w-[340px] glass border-l border-white/5 p-4 hidden xl:flex flex-col">
        <h3 className="text-[12px] uppercase tracking-widest text-text-tertiary mb-4">Tu Pedido</h3>
        <div className="flex-1 space-y-2 overflow-y-auto">
          {cart.map(c=>(
            <div key={c.dish.id} className="flex justify-between text-[13px] bg-surface-1 rounded-sm p-2">
              <span>{c.qty}x {c.dish.name}</span><span className="text-mono text-text-secondary">${c.dish.price*c.qty}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-white/5 pt-4 mt-4">
          <div className="flex justify-between text-mono mb-4"><span>Total</span><span className="text-amber font-bold">${cart.reduce((s,c)=>s+c.dish.price*c.qty,0)}</span></div>
          <button onClick={onSend} className="w-full h-[56px] rounded-md bg-amber text-black font-bold text-[15px] shadow-glowAmber">Enviar a Cocina</button>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button onClick={onCallWaiter} className="h-11 rounded-sm glass text-[12px]">Llamar Mozo</button>
            <button onClick={onRequestBill} className="h-11 rounded-sm glass text-[12px]">Pedir Cuenta</button>
          </div>
        </div>
      </aside>
    </div>
  );
}
