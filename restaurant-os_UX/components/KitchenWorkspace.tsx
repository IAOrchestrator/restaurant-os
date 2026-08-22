import { useEffect, useState } from "react";

type TicketStatus = "recibido" | "en_prep" | "listo";
type TicketItem = { id: string; qty: number; name: string; note?: string };
type Ticket = {
  id: string;
  table: string;
  waiter: string;
  status: TicketStatus;
  createdAt: number; // timestamp
  items: TicketItem[];
};

function useElapsed(createdAt: number) {
  const [sec, setSec] = useState(() => Math.floor((Date.now() - createdAt) / 1000));
  useEffect(() => {
    const i = setInterval(() => setSec(Math.floor((Date.now() - createdAt) / 1000)), 1000);
    return () => clearInterval(i);
  }, [createdAt]);
  return sec;
}

function Timer({ createdAt }: { createdAt: number }) {
  const elapsed = useElapsed(createdAt);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  const level = elapsed > 900 ? "danger" : elapsed > 600 ? "warning" : "normal";
  return (
    <span className={\`text-mono px-2.5 py-1 rounded-pill text-xs font-bold \${ 
      level === "danger" ? "bg-crimson text-white animate-pulse-danger" :
      level === "warning" ? "bg-orange text-white animate-pulse-warning" :
      "bg-surface-2 text-text-secondary"
    }\`}>
      {String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}
    </span>
  );
}

export function KitchenWorkspace({ tickets, onStatusChange }: {
  tickets: Ticket[];
  onStatusChange: (id: string, next: TicketStatus) => void;
}) {
  const cols: { key: TicketStatus; title: string }[] = [
    { key: "recibido", title: "Recibido" },
    { key: "en_prep", title: "En Preparación" },
    { key: "listo", title: "Listo" },
  ];

  return (
    <div className="min-h-screen bg-background p-4">
      <header className="glass sticky top-4 z-10 rounded-lg px-4 h-[60px] flex items-center justify-between mb-4">
        <div className="flex gap-3">
          {cols.map(c => (
            <div key={c.key} className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-widest text-text-tertiary">{c.title}</span>
              <span className="bg-surface-2 text-text-primary text-xs px-2 py-0.5 rounded-pill">{tickets.filter(t=>t.status===c.key).length}</span>
            </div>
          ))}
        </div>
        <div className="text-mono text-sm text-text-secondary">{new Date().toLocaleTimeString()}</div>
      </header>

      <div className="grid grid-cols-3 gap-4">
        {cols.map(col => (
          <div key={col.key} className="rounded-lg bg-surface-1/60 border border-white/[0.04] p-3 min-h-[70vh]">
            <h3 className="text-[12px] uppercase tracking-widest text-text-tertiary mb-3">{col.title}</h3>
            <div className="space-y-3">
              {tickets.filter(t=>t.status===col.key).map(ticket => {
                const elapsed = Math.floor((Date.now()-ticket.createdAt)/1000);
                const border = elapsed>900 ? "border-crimson" : elapsed>600 ? "border-orange" : "border-white/5";
                return (
                  <div key={ticket.id} className={\`glass rounded-md p-3 border-l-4 \${border} shadow-card\`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold">{ticket.table} • {ticket.waiter}</span>
                      <Timer createdAt={ticket.createdAt} />
                    </div>
                    <div className="space-y-1.5 mb-3">
                      {ticket.items.map(it => (
                        <div key={it.id} className="text-[13px]">
                          <span className="font-bold text-amber">{it.qty}x</span> {it.name}
                          {it.note && <div className="mt-1 text-[11px] text-amber bg-amber-muted px-2 py-1 rounded-xs italic">• {it.note}</div>}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {ticket.status !== "recibido" && <button onClick={()=>onStatusChange(ticket.id, "recibido")} className="h-[56px] rounded-sm bg-surface-2 text-text-secondary text-sm">Atrás</button>}
                      {ticket.status === "recibido" && <button onClick={()=>onStatusChange(ticket.id, "en_prep")} className="h-[56px] col-span-2 rounded-sm bg-amber text-black font-bold text-[15px] shadow-glowAmber hover:bg-amber-hover">COCINAR</button>}
                      {ticket.status === "en_prep" && <button onClick={()=>onStatusChange(ticket.id, "listo")} className="h-[56px] col-span-2 rounded-sm bg-emerald text-white font-bold text-[15px] shadow-glowEmerald hover:brightness-110">LISTO ✓</button>}
                      {ticket.status === "listo" && <button onClick={()=>onStatusChange(ticket.id, "recibido")} className="h-[56px] col-span-2 rounded-sm bg-surface-2 text-text-secondary">Reabrir</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
