type OrderStep = { key: string; label: string; done: boolean; active: boolean; time?: string };
type SharedItem = { user: string; avatar: string; items: string[]; amount: number };

export function CustomerWorkspace({ orderSteps, shared, total, table }: {
  table: string;
  orderSteps: OrderStep[];
  shared: SharedItem[];
  total: number;
}) {
  return (
    <div className="mx-auto w-[390px] min-h-[844px] bg-background rounded-[24px] border border-white/5 overflow-hidden p-4">
      <header className="flex justify-between items-center mb-6">
        <div><div className="text-[11px] uppercase tracking-widest text-text-tertiary">Mesa</div><div className="text-xl font-bold">{table}</div></div>
        <div className="text-right"><div className="text-[11px] text-text-tertiary">Mozo</div><div className="text-sm font-medium">Lucía • 🟢</div></div>
      </header>

      <h3 className="text-[12px] uppercase tracking-widest text-text-tertiary mb-3">Tu Pedido en Vivo</h3>
      <div className="relative pl-6 border-l border-white/10 space-y-6 mb-8">
        {orderSteps.map(s=>(
          <div key={s.key} className="relative">
            <div className={\`absolute -left-[25px] w-3 h-3 rounded-full border-2 \${s.done ? "bg-emerald border-emerald" : s.active ? "bg-amber border-amber animate-pulse-warning" : "bg-surface-2 border-white/20"}\`} />
            <div className={\`text-sm \${s.active ? "text-white font-semibold" : s.done ? "text-text-secondary" : "text-text-tertiary"}\`}>{s.label} {s.time && <span className="text-mono text-xs ml-2">{s.time}</span>}</div>
          </div>
        ))}
      </div>

      <h3 className="text-[12px] uppercase tracking-widest text-text-tertiary mb-3">Cuenta Compartida • ${total}</h3>
      <div className="space-y-2">
        {shared.map(p=>(
          <div key={p.user} className="glass rounded-md p-3 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-surface-2 flex items-center justify-center text-xs">{p.avatar}</div>
              <div><div className="text-sm font-medium">{p.user}</div><div className="text-[11px] text-text-secondary">{p.items.join(", ")}</div></div>
            </div>
            <div className="text-mono text-sm">${p.amount}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2">
        <button className="h-11 rounded-md glass text-sm">+ Agregar</button>
        <button className="h-11 rounded-md bg-amber text-black font-bold text-sm">Pagar mi parte</button>
      </div>
    </div>
  );
}
