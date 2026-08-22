import { useState } from "react";
type Mesa = { id: string; label: string; pax: number; status: "ocupada"|"libre" };
type MenuItem = { id: string; name: string; price: number; cat: string };
type CartItem = MenuItem & { qty: number; note?: string };

export function WaiterWorkspace({ mesas, menu, onSend }: {
  mesas: Mesa[];
  menu: MenuItem[];
  onSend: (mesaId: string, items: CartItem[]) => void;
}) {
  const [mesaActiva, setMesaActiva] = useState(mesas[0]?.id);
  const [cat, setCat] = useState("Principal");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [alerta, setAlerta] = useState<{mesa:string; plato:string}|null>({mesa:"Mesa 12", plato:"Lomo Completo"});
  const cats = [...new Set(menu.map(m=>m.cat))];

  const add = (item: MenuItem) => {
    setCart(prev => {
      const ex = prev.find(p=>p.id===item.id);
      if(ex) return prev.map(p=>p.id===item.id?{...p, qty:p.qty+1}:p);
      return [...prev, {...item, qty:1}];
    });
  };

  return (
    <div className="mx-auto w-[390px] min-h-[844px] bg-background border border-white/5 rounded-[32px] overflow-hidden relative shadow-2xl">
      {/* Alerta Plato Listo */}
      {alerta && (
        <div className="absolute top-0 left-0 right-0 z-20 glass-strong border-b border-emerald/30 px-4 py-3 flex justify-between items-center animate-slide-in">
          <div>
            <div className="text-[11px] uppercase text-emerald tracking-widest">Plato Listo</div>
            <div className="text-sm font-semibold">{alerta.mesa} — {alerta.plato}</div>
          </div>
          <button onClick={()=>setAlerta(null)} className="h-9 px-4 rounded-pill bg-emerald text-white text-sm font-bold">ENTREGAR</button>
        </div>
      )}

      <header className="h-[88px] px-4 pt-8 glass sticky top-0 z-10">
        <div className="text-[11px] uppercase tracking-widest text-text-tertiary mb-2">Mis Mesas</div>
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {mesas.map(m=>(
            <button key={m.id} onClick={()=>setMesaActiva(m.id)} className={\`shrink-0 h-8 px-3 rounded-pill text-[13px] border \${mesaActiva===m.id ? "bg-amber text-black border-amber font-bold" : "bg-surface-2 border-white/5 text-text-secondary"}\`}>
              {m.label} • {m.pax}p
            </button>
          ))}
        </div>
      </header>

      <div className="px-3 py-2 flex gap-2 overflow-x-auto">
        {cats.map(c=>(
          <button key={c} onClick={()=>setCat(c)} className={\`h-8 px-3 rounded-pill text-[13px] \${cat===c ? "bg-surface-2 text-white" : "text-text-tertiary"}\`}>{c}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 p-3 pb-[160px]">
        {menu.filter(m=>m.cat===cat).map(item=>(
          <button key={item.id} onClick={()=>add(item)} className="glass rounded-md p-3 text-left active:scale-[0.98] transition">
            <div className="text-[13px] font-medium leading-tight">{item.name}</div>
            <div className="text-mono text-amber text-[12px] mt-1">${item.price}</div>
          </button>
        ))}
      </div>

      {/* Carrito flotante glass - thumb zone */}
      <div className="absolute bottom-[72px] left-3 right-3 glass-strong rounded-lg p-3 shadow-glass">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[12px] uppercase tracking-widest text-text-tertiary">{mesaActiva} • {cart.length} items</span>
          <span className="text-mono text-sm">${cart.reduce((s,i)=>s+i.price*i.qty,0)}</span>
        </div>
        <div className="max-h-[80px] overflow-y-auto space-y-1 mb-3">
          {cart.map(c=>(
            <div key={c.id} className="flex justify-between text-[12px]"><span>{c.qty}x {c.name}</span><button onClick={()=>setCart(cart.filter(x=>x.id!==c.id))} className="text-text-tertiary">✕</button></div>
          ))}
        </div>
        <button onClick={()=>onSend(mesaActiva, cart)} className="w-full h-[48px] rounded-sm bg-amber text-black font-bold text-[14px]">Enviar a Cocina</button>
      </div>

      <nav className="absolute bottom-0 left-0 right-0 h-[64px] glass border-t border-white/5 flex">
        {["Mesas","Comanda","Alertas"].map(t=>(
          <button key={t} className="flex-1 text-[11px] uppercase tracking-widest text-text-secondary flex flex-col items-center justify-center gap-1">
            <span className="w-5 h-5 bg-white/10 rounded-full" />{t}
          </button>
        ))}
      </nav>
    </div>
  );
}
