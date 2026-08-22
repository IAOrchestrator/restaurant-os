import { useState } from "react";
type Line = { id: string; name: string; qty: number; price: number; note?: string };
type Payment = { method: "efectivo"|"tarjeta"|"qr"|"mercadopago"; amount: number };

export function CashierWorkspace({ lines, onPay }: {
  lines: Line[];
  onPay: (payments: Payment[]) => void;
}) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [splitOpen, setSplitOpen] = useState(false);
  const total = lines.reduce((s,l)=>s+l.qty*l.price,0);
  const paid = payments.reduce((s,p)=>s+p.amount,0);
  const remain = total - paid;

  return (
    <div className="min-h-screen bg-background flex">
      <div className="flex-[1.2] p-6 border-r border-white/5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Mesa 12 • Fede</h2>
          <button onClick={()=>setSplitOpen(true)} className="h-8 px-3 rounded-pill glass text-xs">Dividir Cuenta</button>
        </div>
        <div className="space-y-2">
          {lines.map(l=>(
            <div key={l.id} className="flex justify-between py-3 border-b border-white/5">
              <div><div className="text-sm"><span className="text-amber font-bold">{l.qty}x</span> {l.name}</div>{l.note && <div className="text-[11px] text-text-tertiary">{l.note}</div>}</div>
              <div className="text-mono text-sm">${l.qty*l.price}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-between text-mono text-[15px]"><span className="text-text-tertiary">Total</span><span className="font-bold text-lg">${total}</span></div>
      </div>

      <div className="flex-1 p-6 bg-surface-1">
        <h3 className="text-[12px] uppercase tracking-widest text-text-tertiary mb-4">Método de Pago</h3>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {(["efectivo","tarjeta","qr","mercadopago"] as const).map(m=>(
            <button key={m} onClick={()=>setPayments([...payments, {method:m, amount: remain>0 ? remain : 0}])} className="h-[72px] rounded-md glass hover:bg-white/10 capitalize font-medium">{m}</button>
          ))}
        </div>

        <div className="glass rounded-md p-3 mb-4">
          <div className="text-xs text-text-tertiary mb-2">Calculadora</div>
          <div className="grid grid-cols-3 gap-2">
            {[1,2,3,4,5,6,7,8,9,".",0,"⌫"].map(k=>(
              <button key={String(k)} className="h-11 rounded-sm bg-surface-2 text-sm">{k}</button>
            ))}
          </div>
        </div>

        <div className="space-y-2 mb-4">
          {payments.map((p,i)=>(
            <div key={i} className="flex justify-between text-sm bg-emerald-muted border border-emerald/20 rounded-sm p-2">
              <span className="capitalize">{p.method}</span><span className="text-mono">${p.amount}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-between text-mono mb-4"><span>Restante</span><span className={\`font-bold \${remain===0 ? "text-emerald" : "text-crimson"}\`}>${remain}</span></div>
        <button disabled={remain!==0} onClick={()=>onPay(payments)} className="w-full h-[56px] rounded-md bg-emerald text-white font-bold disabled:bg-surface-2 disabled:text-text-tertiary">Cobrar y Cerrar Mesa</button>
      </div>

      {splitOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-strong rounded-lg p-6 w-[420px]">
            <h3 className="font-semibold mb-4">Dividir Cuenta</h3>
            <div className="flex gap-2 mb-4">
              <button className="flex-1 h-9 rounded-sm bg-amber text-black text-xs font-bold">Equitativo</button>
              <button className="flex-1 h-9 rounded-sm bg-surface-2 text-xs">Por Items</button>
              <button className="flex-1 h-9 rounded-sm bg-surface-2 text-xs">Por Monto</button>
            </div>
            <button onClick={()=>setSplitOpen(false)} className="w-full h-10 rounded-sm bg-surface-2 text-sm">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
