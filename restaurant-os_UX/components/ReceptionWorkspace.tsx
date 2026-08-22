type TableNode = { id: string; label: string; type: "round"|"rect"; x: number; y: number; status: "libre"|"ocupada"|"reservada"|"por_cobrar"; pax: number; waiter?: string; amount?: number; time?: string };
type Waitlist = { id: string; name: string; pax: number; preOrder?: string; waitMin: number };

export function ReceptionWorkspace({ tables, waitlist, onAssign }: {
  tables: TableNode[];
  waitlist: Waitlist[];
  onAssign: (waitId: string, tableId: string) => void;
}) {
  const statusStyle = {
    libre: "border-dashed border-white/20 bg-transparent text-text-tertiary",
    ocupada: "bg-surface-2 border border-white/10 text-white",
    reservada: "border-2 border-amber bg-amber-muted text-amber",
    por_cobrar: "bg-emerald-muted border border-emerald/30 text-emerald",
  };
  return (
    <div className="min-h-screen bg-background flex">
      <div className="flex-1 p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">Plano del Salón</h1>
          <div className="flex gap-2 text-[11px]">
            {Object.keys(statusStyle).map(s=>(
              <span key={s} className={\`px-2 py-1 rounded-pill border \${statusStyle[s as keyof typeof statusStyle]}\`}>{s}</span>
            ))}
          </div>
        </div>
        <div className="relative w-full h-[640px] rounded-lg bg-surface-1 border border-white/5 overflow-hidden">
          {/* grid sutil */}
          <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)", backgroundSize: "40px 40px"}} />
          {tables.map(t=>(
            <div key={t.id} style={{left: t.x, top: t.y}} className="absolute">
              <div className={\`w-[96px] h-[96px] \${t.type==="round" ? "rounded-full" : "rounded-md"} \${statusStyle[t.status]} flex flex-col items-center justify-center cursor-pointer hover:scale-105 transition shadow-card\`}>
                <span className="text-[18px] font-bold">{t.label}</span>
                <span className="text-[10px]">{t.pax}p {t.waiter ? "• "+t.waiter : ""}</span>
                {t.amount && <span className="text-mono text-[10px] mt-0.5">${t.amount}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <aside className="w-[360px] glass border-l border-white/5 p-4">
        <h3 className="text-[12px] uppercase tracking-widest text-text-tertiary mb-4">Lista de Espera • {waitlist.length}</h3>
        <div className="space-y-3">
          {waitlist.map(w=>(
            <div key={w.id} className="glass rounded-md p-3">
              <div className="flex justify-between">
                <span className="font-medium text-sm">{w.name}</span><span className="text-mono text-xs text-text-secondary">{w.waitMin}m</span>
              </div>
              <div className="text-[12px] text-text-secondary">{w.pax} personas {w.preOrder && "• Pre-pedido: "+w.preOrder}</div>
              <div className="mt-2 flex gap-2">
                <select className="flex-1 h-8 rounded-sm bg-surface-2 text-xs px-2">
                  <option>Mesa...</option>
                  {tables.filter(t=>t.status==="libre").map(t=>(
                    <option key={t.id} value={t.id}>{t.label} ({t.pax}p)</option>
                  ))}
                </select>
                <button onClick={()=>onAssign(w.id, tables.find(t=>t.status==="libre")?.id || "")} className="h-8 px-3 rounded-sm bg-amber text-black text-xs font-bold">Asignar</button>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
