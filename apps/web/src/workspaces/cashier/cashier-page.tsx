import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import { useAppContext } from '../../hooks/useContextState';
import { useSse } from '../../hooks/useSse';
import {
  CreditCard,
  Banknote,
  QrCode,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Receipt,
  Lock,
  DollarSign,
  Calculator,
  Percent,
} from 'lucide-react';

export interface BillingAccount {
  id: string;
  tableSessionId: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: 'OPEN' | 'PAID' | 'CLOSED';
}

export function CashierPage() {
  const { restaurantId, authToken } = useAppContext();
  const { request } = useApi();

  const [accounts, setAccounts] = useState<BillingAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<BillingAccount | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER' | 'QR'>('CASH');
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    const res = await request<BillingAccount[]>(`/api/billing/accounts?restaurantId=${restaurantId}`);
    if (res.data) {
      setAccounts(res.data);
      if (selectedAccount) {
        const updated = res.data.find((a) => a.id === selectedAccount.id);
        if (updated) setSelectedAccount(updated);
      }
    }
    setLoading(false);
  }, [request, restaurantId, selectedAccount]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Real-time SSE & snapshot on reconnect
  useSse({
    token: authToken,
    eventTypes: ['TABLE_ASSIGNED', 'ORDER_DELIVERED', 'ACCOUNT_REQUESTED', 'PAYMENT_REGISTERED', 'ACCOUNT_CLOSED', 'TABLE_CLOSED'],
    onEvent: () => {
      fetchAccounts();
    },
    onReconnect: () => {
      fetchAccounts();
    },
  });

  const handleSelectAccount = (account: BillingAccount) => {
    setSelectedAccount(account);
    const pendingBalance = Math.max(0, account.totalAmount - account.paidAmount);
    setPaymentAmount(pendingBalance);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount || paymentAmount <= 0) return;

    setMsg(null);
    const res = await request(`/api/billing/accounts/${selectedAccount.id}/payments`, {
      method: 'POST',
      body: JSON.stringify({
        amount: Number(paymentAmount),
        method: paymentMethod,
      }),
    });

    if (res.error) {
      setMsg({ type: 'error', text: res.error });
    } else {
      setMsg({ type: 'success', text: `💵 ¡Pago de $${paymentAmount.toLocaleString()} registrado con éxito!` });
      fetchAccounts();
    }
  };

  const handleCloseAccount = async (accountId: string) => {
    setMsg(null);
    const res = await request(`/api/billing/accounts/${accountId}/close`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    if (res.error) {
      setMsg({ type: 'error', text: res.error });
    } else {
      setMsg({ type: 'success', text: '🔒 Cuenta cerrada y mesa liberada con éxito.' });
      setSelectedAccount(null);
      fetchAccounts();
    }
  };

  const openAccounts = accounts.filter((a) => a.status !== 'CLOSED');
  const selectedPending = selectedAccount ? Math.max(0, selectedAccount.totalAmount - selectedAccount.paidAmount) : 0;

  return (
    <div className="min-h-screen bg-background text-text-primary p-4 lg:p-6">
      {/* Header Bar */}
      <header className="glass sticky top-0 z-20 rounded-lg px-5 h-[64px] flex items-center justify-between mb-6 shadow-card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-sm bg-emerald text-white flex items-center justify-center font-bold shadow-glowEmerald">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">Caja & Facturación (POS)</h1>
            <p className="text-xs text-text-tertiary">Gestión de cuentas, cobro rápido y división de pagos</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono px-3 py-1 rounded-pill bg-surface-2 text-text-secondary border border-white/5">
            {openAccounts.length} cuentas abiertas
          </span>
          <button
            onClick={fetchAccounts}
            disabled={loading}
            className="h-9 px-3 rounded-pill glass hover:bg-white/10 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
            title="Refrescar"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refrescar</span>
          </button>
        </div>
      </header>

      {/* Messages */}
      {msg && (
        <div
          className={`p-3.5 rounded-md mb-6 text-xs font-medium flex items-center gap-2.5 shadow-card animate-slide-in ${
            msg.type === 'success'
              ? 'bg-emerald/15 border border-emerald/30 text-emerald'
              : 'bg-crimson/15 border border-crimson/30 text-crimson'
          }`}
        >
          {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Main Split Layout: Left 60% Accounts, Right 40% POS Payment Terminal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Accounts List */}
        <section className="lg:col-span-7 rounded-lg bg-surface-1 border border-white/5 p-5 shadow-card">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/5">
            <h2 className="text-sm font-bold">Cuentas y Consumos por Mesa</h2>
            <span className="text-xs font-mono text-text-tertiary">Selecciona para cobrar</span>
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {openAccounts.length === 0 ? (
              <div className="h-48 border border-dashed border-white/10 rounded-md flex flex-col items-center justify-center text-text-tertiary gap-2">
                <Receipt className="w-7 h-7 opacity-30" />
                <span className="text-xs">No hay cuentas pendientes de cobro</span>
              </div>
            ) : (
              openAccounts.map((acc) => {
                const pending = Math.max(0, acc.totalAmount - acc.paidAmount);
                const isSelected = selectedAccount?.id === acc.id;
                const isPaid = acc.status === 'PAID' || pending === 0;

                return (
                  <div
                    key={acc.id}
                    onClick={() => handleSelectAccount(acc)}
                    className={`p-4 rounded-md border transition-all cursor-pointer shadow-sm hover:scale-[1.01] ${
                      isSelected
                        ? 'bg-surface-2 border-amber shadow-glowAmber'
                        : isPaid
                        ? 'bg-emerald/10 border-emerald/30'
                        : 'glass border-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xs bg-white text-black font-bold text-xs flex items-center justify-center shadow-sm">
                          M
                        </div>
                        <div>
                          <div className="text-sm font-bold text-text-primary">Sesión #{acc.tableSessionId.slice(0, 6)}</div>
                          <div className="text-[11px] text-text-tertiary font-mono">ID Cuenta: #{acc.id.slice(0, 6)}</div>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold font-mono px-2.5 py-0.5 rounded-pill ${
                          isPaid
                            ? 'bg-emerald text-white'
                            : 'bg-amber/15 text-amber border border-amber/30'
                        }`}
                      >
                        {isPaid ? 'PAGADO COMPLETO' : 'PENDIENTE'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5 text-xs font-mono">
                      <div>
                        <div className="text-[10px] text-text-tertiary uppercase">Total</div>
                        <div className="font-bold text-text-primary mt-0.5">${acc.totalAmount.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-text-tertiary uppercase">Pagado</div>
                        <div className="font-bold text-emerald mt-0.5">${acc.paidAmount.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-text-tertiary uppercase">Resta</div>
                        <div className={`font-bold mt-0.5 ${pending > 0 ? 'text-amber' : 'text-text-tertiary'}`}>
                          ${pending.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Right Side: POS Payment Form */}
        <section className="lg:col-span-5 rounded-lg bg-surface-1 border border-white/5 p-5 shadow-card">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/5">
            <h2 className="text-sm font-bold">Terminal de Pago</h2>
            <Calculator className="w-4 h-4 text-amber" />
          </div>

          {!selectedAccount ? (
            <div className="h-72 border border-dashed border-white/10 rounded-md flex flex-col items-center justify-center text-text-tertiary gap-2 p-6 text-center">
              <CreditCard className="w-8 h-8 opacity-30" />
              <span className="text-xs">Selecciona una cuenta de la lista para registrar el cobro</span>
            </div>
          ) : (
            <form onSubmit={handleRecordPayment} className="space-y-4">
              {/* Payment Methods Grid */}
              <div>
                <label className="text-xs text-text-secondary block mb-2 font-medium">Medio de Pago:</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'CASH', label: 'Efectivo', icon: Banknote },
                    { id: 'CARD', label: 'Tarjeta', icon: CreditCard },
                    { id: 'QR', label: 'QR / Digital', icon: QrCode },
                    { id: 'TRANSFER', label: 'Transferencia', icon: ArrowRight },
                  ].map((method) => {
                    const Icon = method.icon;
                    const isMethodSelected = paymentMethod === method.id;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setPaymentMethod(method.id as any)}
                        className={`h-12 rounded-sm border p-2 flex items-center justify-center gap-2 text-xs font-semibold transition ${
                          isMethodSelected
                            ? 'bg-amber text-black border-amber shadow-glowAmber font-bold'
                            : 'glass border-white/5 text-text-secondary hover:text-white'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{method.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Amount Input & Quick Presets */}
              <div>
                <label className="text-xs text-text-secondary block mb-2 font-medium">Monto a Cobrar ($):</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={paymentAmount || ''}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  required
                  className="w-full h-12 rounded-sm bg-surface-2 border border-white/10 px-4 text-lg font-mono font-bold text-amber focus:outline-none focus:border-amber"
                />

                {/* Quick Split Buttons */}
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(selectedPending)}
                    className="h-8 rounded-pill glass text-xs font-mono font-bold hover:bg-white/10"
                  >
                    100% (${selectedPending.toLocaleString()})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(Math.round(selectedPending / 2))}
                    className="h-8 rounded-pill glass text-xs font-mono font-bold hover:bg-white/10"
                  >
                    50% (${Math.round(selectedPending / 2).toLocaleString()})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(Math.round(selectedPending / 4))}
                    className="h-8 rounded-pill glass text-xs font-mono font-bold hover:bg-white/10"
                  >
                    25% (${Math.round(selectedPending / 4).toLocaleString()})
                  </button>
                </div>
              </div>

              {/* Submit Payment Action */}
              <button
                type="submit"
                disabled={paymentAmount <= 0}
                className="w-full h-12 rounded-sm bg-emerald text-white hover:bg-emerald-muted font-bold text-xs flex items-center justify-center gap-2 shadow-glowEmerald transition active:scale-98 disabled:opacity-40"
              >
                <DollarSign className="w-4 h-4" />
                <span>REGISTRAR COBRO (${paymentAmount.toLocaleString()})</span>
              </button>

              {/* Close Account Action */}
              {selectedPending === 0 && (
                <button
                  type="button"
                  onClick={() => handleCloseAccount(selectedAccount.id)}
                  className="w-full h-11 rounded-sm bg-surface-2 border border-emerald/40 text-emerald hover:bg-emerald/20 font-bold text-xs flex items-center justify-center gap-2 transition"
                >
                  <Lock className="w-4 h-4" />
                  <span>Cerrar Cuenta y Liberar Mesa</span>
                </button>
              )}
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
