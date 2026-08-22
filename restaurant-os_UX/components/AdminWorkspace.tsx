import { useState } from "react";
type DishRow = { id: string; name: string; price: number; available: boolean; cat: string; sales: number };
type Metric = { label: string; value: string; delta: string };

export function AdminWorkspace({ metrics, dishes }: {
  metrics: Metric[];
  dishes: DishRow[];
}) {
  const [filter, setFilter] = useState("Todos");
  const cats = ["Todos", ...Array.from(new Set(dishes.map(d=>d.cat)))];
  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-[240px] glass border-r border-white/5 p-4">
        <div className="text-[12px] font-bold tracking-widest mb-6">RESTAURANT OS</div>
        <div className="space-y-1 text-sm text-text-secondary">
          {["Dashboard","Catálogo","Staff","Mesas","Métricas"].map(i=>(
            <div key={i} className="h-9 px-3 rounded-sm hover:bg-white/5 flex items-center cursor-pointer">{i}</div>
          ))}
        </div>
      </aside>
      <main className="flex-1 p-6">
        <div className="grid grid-cols-4 gap-4 mb-6">
          {metrics.map(m=>(
            <div key={m.label} className="glass rounded-md p-4">
              <div className="text-[11px] uppercase tracking-widest text-text-tertiary">{m.label}</div>
              <div className="text-2xl font-bold mt-1 text-mono">{m.value}</div>
              <div className="text-xs text-emerald mt-1">{m.delta} vs ayer</div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold">Catálogo de Platos</h2>
          <div className="flex gap-2">
            {cats.map(c=>(
              <button key={c} onClick={()=>setFilter(c)} className={\`h-7 px-3 rounded-pill text-xs \${filter===c ? "bg-amber text-black font-bold" : "bg-surface-2 text-text-secondary"}\`}>{c}</button>
            ))}
          </div>
        </div>

        <div className="glass rounded-lg overflow-hidden">
          <div className="grid grid-cols-[40px_1fr_80px_80px_60px] gap-4 px-4 h-10 items-center text-[11px] uppercase tracking-widest text-text-tertiary border-b border-white/5">
            <span>Img</span><span>Nombre</span><span>Precio</span><span>Ventas</span><span>Activo</span>
          </div>
          {dishes.filter(d=>filter==="Todos"||d.cat===filter).map(d=>(
            <div key={d.id} className="grid grid-cols-[40px_1fr_80px_80px_60px] gap-4 px-4 h-[56px] items-center border-b border-white/[0.04] hover:bg-white/[0.02]">
              <div className="w-8 h-8 rounded-sm bg-surface-2" />
              <div><div className="text-sm font-medium">{d.name}</div><div className="text-[11px] text-text-tertiary">{d.cat}</div></div>
              <div className="text-mono text-sm">${d.price}</div>
              <div className="text-mono text-xs text-text-secondary">{d.sales}</div>
              <button className={\`w-10 h-6 rounded-pill relative transition \${d.available ? "bg-emerald" : "bg-surface-3"}\`}><span className={\`absolute top-0.5 w-5 h-5 bg-white rounded-full transition \${d.available ? "left-4" : "left-0.5"}\`} /></button>
            </div>
          ))}
        </div>

        <div className="mt-6 glass rounded-lg p-4">
          <h3 className="text-xs uppercase tracking-widest text-text-tertiary mb-3">Mapa de Calor - Ocupación por Hora</h3>
          <div className="grid grid-cols-12 gap-1">
            {Array.from({length: 48}).map((_,i)=>{
              const intensity = Math.random();
              return <div key={i} className="h-6 rounded-xs" style={{background: \`hsla(38 90% 56% / \${intensity})\`}} />
            })}
          </div>
          <div className="flex justify-between text-[10px] text-text-tertiary mt-2"><span>12:00</span><span>16:00</span><span>20:00</span><span>00:00</span></div>
        </div>
      </main>
    </div>
  );
}
