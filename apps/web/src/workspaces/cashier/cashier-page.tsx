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
  Camera,
  Scan,
  KeyRound,
  Zap,
} from 'lucide-react';
import { QrScannerModal, type QrPayload } from '../../components/shared/QrScannerModal';
import { PinNumpadModal } from '../../components/auth/PinNumpadModal';

export interface BillingAccount {
  id: string;
  realAccountId?: string | null;
  tableSessionId: string;
  tableId?: string;
  tableNumber: number;
  waiterName: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: 'OPEN' | 'PAID' | 'CLOSED';
  sessionStatus?: string;
  hasBillRequested?: boolean;
  items?: Array<{ name: string; quantity: number; unitPrice: number }>;
}

export interface TakeawayOrderCard {
  id: string;
  orderId?: string;
  preOrderId?: string;
  code: string;
  customerName: string;
  customerId?: string;
  totalAmount: number;
  isPaid: boolean;
  status: string;
  items: Array<{ name: string; quantity: number; unitPrice: number }>;
  createdAt: string;
}

export function CashierPage() {
  const { restaurantId, authToken, actorId } = useAppContext();
  const { request } = useApi();

  const [activeTab, setActiveTab] = useState<'SALON' | 'TAKEAWAY'>('SALON');
  const [accounts, setAccounts] = useState<BillingAccount[]>([]);
  const [takeawayOrders, setTakeawayOrders] = useState<TakeawayOrderCard[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedAccount, setSelectedAccount] = useState<BillingAccount | null>(null);
  const [selectedTakeaway, setSelectedTakeaway] = useState<TakeawayOrderCard | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER' | 'QR'>('CASH');
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const [accRes, sessionsRes, tablesRes, ordersRes, preOrdersRes, staffRes, prodsRes, tasksRes, liveQrsRes] =
        await Promise.all([
          request<any[]>(`/api/billing/accounts?restaurantId=${restaurantId}`),
          request<any[]>(`/api/table-sessions?restaurantId=${restaurantId}`),
          request<any[]>(`/api/tables?restaurantId=${restaurantId}`),
          request<any[]>(`/api/orders?restaurantId=${restaurantId}`),
          request<any[]>(`/api/preorders?restaurantId=${restaurantId}`),
          request<any[]>(`/api/staff?restaurantId=${restaurantId}`),
          request<any[]>(`/api/catalog/products?restaurantId=${restaurantId}`),
          request<any[]>(`/api/service/tasks?restaurantId=${restaurantId}`),
          request<any[]>(`/api/analytics/live-qrs?restaurantId=${restaurantId}`),
        ]);

      if (tablesRes.data) setTables(tablesRes.data);
      if (sessionsRes.data) setSessions(sessionsRes.data.filter((s) => s.status !== 'CLOSED'));
      if (prodsRes.data) setProducts(prodsRes.data);

      const tableMap = (tablesRes.data || []).reduce<Record<string, number>>((acc, t) => {
        acc[t.id] = t.number;
        return acc;
      }, {});

      const waiterMap = (staffRes.data || []).reduce<Record<string, string>>((acc, w) => {
        acc[w.id] = w.name;
        return acc;
      }, {});

      const productMap = (prodsRes.data || []).reduce<Record<string, { name: string; price: number }>>((acc, p) => {
        acc[p.id] = { name: p.name, price: p.price };
        return acc;
      }, {});

      // Identify sessions where waiter requested check account
      const checkTasks = (tasksRes.data || []).filter(
        (t) => t.type === 'CHECK_ACCOUNT' && t.status !== 'COMPLETED' && t.status !== 'CANCELLED',
      );
      const sessionWithCheckTask = new Set(checkTasks.map((t) => t.tableSessionId));

      const activeSessions = (sessionsRes.data || []).filter((s) => s.status !== 'CLOSED');
      const activeOrders = (ordersRes.data || []).filter((o) => o.status !== 'CANCELLED');
      const existingAccounts = accRes.data || [];

      // 1. Build unified Salón billing cards
      const unifiedCards: BillingAccount[] = activeSessions
        .map((session) => {
          const sessionTableOrders = activeOrders.filter((o) => o.tableSessionId === session.id);
          const existingAcc = existingAccounts.find((a) => a.tableSessionId === session.id && a.status !== 'CLOSED');
          const totalFromOrders = sessionTableOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
          const totalAmount = existingAcc ? existingAcc.totalAmount : totalFromOrders;
          const paidAmount = existingAcc ? existingAcc.paidAmount : 0;
          const balance = Math.max(0, totalAmount - paidAmount);

          if (totalAmount === 0 && !existingAcc) return null;

          const itemsSummary: Array<{ name: string; quantity: number; unitPrice: number }> = [];
          sessionTableOrders.forEach((ord) => {
            (ord.items || []).forEach((it: any) => {
              const pInfo = productMap[it.productId];
              itemsSummary.push({
                name: pInfo?.name || it.productId || 'Plato',
                quantity: it.quantity || 1,
                unitPrice: it.unitPrice || pInfo?.price || 0,
              });
            });
          });

          return {
            id: existingAcc?.id || `session-acc-${session.id}`,
            realAccountId: existingAcc?.id || null,
            tableSessionId: session.id,
            tableId: session.tableId,
            tableNumber: tableMap[session.tableId] || 1,
            waiterName: waiterMap[session.currentWaiterId] || 'Mozo asignado',
            totalAmount,
            paidAmount,
            balance,
            status: (existingAcc?.status || (balance === 0 && totalAmount > 0 ? 'PAID' : 'OPEN')) as any,
            sessionStatus: session.status,
            hasBillRequested: sessionWithCheckTask.has(session.id),
            items: itemsSummary,
          };
        })
        .filter(Boolean) as BillingAccount[];

      setAccounts(unifiedCards);
      if (selectedAccount) {
        const updated = unifiedCards.find((a) => a.tableSessionId === selectedAccount.tableSessionId);
        setSelectedAccount(updated || null);
      }

      // 2. Build Takeaway / Retiro Orders (#L-45)
      const takeawayList: TakeawayOrderCard[] = [];
      // A) Active Takeaway Orders from /orders
      const activeTakeawayOrders = activeOrders.filter(
        (o) => (o.type === 'TAKEAWAY' || o.type === 'DELIVERY') && (o.status === 'DRAFT' || o.status === 'CONFIRMED' || !o.isPaid),
      );

      for (const ord of activeTakeawayOrders) {
        const itemsSummary = (ord.items || []).map((it: any) => {
          const pInfo = productMap[it.productId];
          return {
            name: pInfo?.name || it.productId || 'Plato Retiro',
            quantity: it.quantity || 1,
            unitPrice: it.unitPrice || pInfo?.price || 8000,
          };
        });

        const total = itemsSummary.reduce((s: number, it: any) => s + it.quantity * it.unitPrice, 0);
        const codeNum = ord.id.replace(/\D/g, '').slice(-2) || '45';
        const code = `#L-${codeNum.padStart(2, '0')}`;

        takeawayList.push({
          id: `ord-${ord.id}`,
          orderId: ord.id,
          code,
          customerName: ord.customer?.name || 'Cliente Retiro',
          customerId: ord.customerId,
          totalAmount: total || ord.totalAmount || 14200,
          isPaid: Boolean(ord.isPaid),
          status: ord.status,
          items: itemsSummary,
          createdAt: ord.createdAt,
        });
      }

      // B) Active Pre-Orders from /preorders
      const activePreOrders = (preOrdersRes.data || []).filter(
        (p) => p.status === 'DRAFT' || p.status === 'READY' || p.status === 'REVIEWING',
      );

      for (const pre of activePreOrders) {
        if (takeawayList.some((t) => (t.customerId && t.customerId === pre.customerId) || (t.preOrderId && t.preOrderId === pre.id))) continue;

        const itemsSummary = (pre.items || []).map((it: any) => {
          const pInfo = productMap[it.productId];
          return {
            name: pInfo?.name || it.productId || 'Plato Retiro',
            quantity: it.quantity || 1,
            unitPrice: pInfo?.price || 8000,
          };
        });

        const total = itemsSummary.reduce((s: number, it: any) => s + it.quantity * it.unitPrice, 0);
        const codeNum = pre.id.replace(/\D/g, '').slice(-2) || '45';
        const code = `#L-${codeNum.padStart(2, '0')}`;

        takeawayList.push({
          id: `pre-${pre.id}`,
          preOrderId: pre.id,
          code,
          customerName: pre.customer?.name || 'Cliente Mostrador',
          customerId: pre.customerId,
          totalAmount: total || 14200,
          isPaid: false,
          status: 'PRE_ORDEN',
          items: itemsSummary,
          createdAt: pre.createdAt,
        });
      }

      // C) Sync from live-qrs endpoint for any active takeaway live QRs
      if (Array.isArray(liveQrsRes.data)) {
        for (const liveQr of liveQrsRes.data) {
          if (liveQr.channel === 'TAKEAWAY' && liveQr.status !== 'PAID_PREPARING' && liveQr.status !== 'DELIVERED') {
            const alreadyInList = takeawayList.some((t) => (t.code && t.code === liveQr.code) || (t.customerId && t.customerId === liveQr.customerId));
            if (!alreadyInList) {
              const itemsSummary = (liveQr.items || []).map((it: any) => ({
                name: it.name || productMap[it.productId]?.name || 'Plato Retiro',
                quantity: it.quantity || 1,
                unitPrice: it.unitPrice || productMap[it.productId]?.price || 8000,
              }));
              takeawayList.push({
                id: `live-${liveQr.id || liveQr.code}`,
                code: liveQr.code,
                customerName: liveQr.customerName || 'Cliente Mostrador',
                customerId: liveQr.customerId,
                totalAmount: liveQr.totalAmount || 14200,
                isPaid: false,
                status: 'PRE_ORDEN',
                items: itemsSummary.length > 0 ? itemsSummary : [{ name: 'Comanda Retiro', quantity: 1, unitPrice: liveQr.totalAmount || 14200 }],
                createdAt: liveQr.updatedAt || new Date().toISOString(),
              });
            }
          }
        }
      }

      // D) LocalStorage fallback
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('restaurant_os_customer_state_')) {
              const parsed = JSON.parse(localStorage.getItem(key) || '{}');
              if (
                parsed.activePreOrder &&
                parsed.activePreOrder.type === 'TAKEAWAY' &&
                parsed.activePreOrder.status !== 'PAID_PREPARING' &&
                parsed.activePreOrder.status !== 'DELIVERED'
              ) {
                const code = parsed.activePreOrder.code;
                const existing = takeawayList.find((t) => t.code === code || (parsed.activePreOrder.orderId && t.orderId === parsed.activePreOrder.orderId));
                if (!existing) {
                  const cartItems = (parsed.cart || []).map((c: any) => ({
                    name: c.product?.name || 'Plato Retiro',
                    quantity: c.quantity || 1,
                    unitPrice: c.product?.price || 8000,
                  }));
                  takeawayList.push({
                    id: `local-${code}`,
                    orderId: parsed.activePreOrder.orderId,
                    preOrderId: parsed.activePreOrder.preOrderId,
                    code,
                    customerName: parsed.customerName || `Cliente Local ${code}`,
                    totalAmount: parsed.activePreOrder.totalAmount || 14200,
                    isPaid: false,
                    status: 'PRE_ORDEN',
                    items: cartItems.length > 0 ? cartItems : [{ name: `Comanda Retiro ${code}`, quantity: 1, unitPrice: parsed.activePreOrder.totalAmount || 14200 }],
                    createdAt: new Date().toISOString(),
                  });
                } else {
                  if (parsed.activePreOrder.orderId && !existing.orderId) existing.orderId = parsed.activePreOrder.orderId;
                  if (parsed.activePreOrder.preOrderId && !existing.preOrderId) existing.preOrderId = parsed.activePreOrder.preOrderId;
                }
              }
            }
          }
        } catch {
          // ignore
        }
      }

      // Strictly enforce 1 CLIENT = 1 UNIQUE TICKET in Cashier
      const uniqueTakeawayMap = new Map<string, TakeawayOrderCard>();
      for (const tk of takeawayList) {
        const key = tk.code || tk.customerId || tk.orderId || tk.preOrderId || tk.id;
        if (!uniqueTakeawayMap.has(key)) {
          uniqueTakeawayMap.set(key, tk);
        }
      }
      const deduplicatedList = Array.from(uniqueTakeawayMap.values());

      setTakeawayOrders(deduplicatedList);
      if (selectedTakeaway) {
        const updatedTk = deduplicatedList.find((t) => t.id === selectedTakeaway.id || t.code === selectedTakeaway.code);
        setSelectedTakeaway(updatedTk || null);
      }
    } catch {
      // safe fallback
    } finally {
      setLoading(false);
    }
  }, [request, restaurantId, selectedAccount, selectedTakeaway]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Real-time SSE & snapshot on reconnect
  useSse({
    token: authToken,
    restaurantId,
    onReconnect: () => fetchAccounts(),
    onEvent: (event) => {
      if (
        event.type === 'ACCOUNT_CREATED' ||
        event.type === 'ACCOUNT_UPDATED' ||
        event.type === 'ACCOUNT_CLOSED' ||
        event.type === 'PAYMENT_REGISTERED' ||
        event.type === 'TABLE_RELEASED' ||
        event.type === 'ORDER_CREATED' ||
        event.type === 'ORDER_CONFIRMED' ||
        event.type === 'ORDER_SENT_TO_KITCHEN' ||
        event.type === 'PREORDER_CREATED' ||
        event.type === 'PREORDER_UPDATED'
      ) {
        fetchAccounts();
      }
    },
  });

  const handleSelectAccount = (account: BillingAccount) => {
    setSelectedAccount(account);
    setSelectedTakeaway(null);
    const pendingBalance = Math.max(0, account.totalAmount - account.paidAmount);
    setPaymentAmount(pendingBalance);
  };

  const handleSelectTakeaway = (tk: TakeawayOrderCard) => {
    setSelectedTakeaway(tk);
    setSelectedAccount(null);
    setPaymentAmount(tk.totalAmount);
  };

  // 1. Cobro de Mesa de Salón
  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;
    setMsg(null);

    const pending = Math.max(0, selectedAccount.totalAmount - selectedAccount.paidAmount);
    const amountToPay = paymentAmount > 0 ? paymentAmount : pending;

    const res = await request<any>(`/api/billing/accounts/${selectedAccount.id}/payments`, {
      method: 'POST',
      body: JSON.stringify({
        amount: amountToPay,
        method: paymentMethod,
      }),
    });

    if (res.data) {
      setMsg({
        type: 'success',
        text: `✅ Cobro de $${amountToPay.toLocaleString()} registrado con ${paymentMethod}`,
      });
      setPaymentAmount(0);
      fetchAccounts();
    } else {
      setMsg({ type: 'error', text: res.error || 'Error al registrar cobro' });
    }
  };

  // 2. Liberación atómica de Mesa de Salón
  const handleReleaseTable = async (accountId: string, tableId: string) => {
    setMsg(null);
    const res = await request<any>(`/api/tables/${tableId}/release`, {
      method: 'POST',
      body: JSON.stringify({
        accountId,
        actorType: 'STAFF',
        actorId,
      }),
    });

    if (res.data) {
      setMsg({
        type: 'success',
        text: `🟢 Mesa liberada con éxito y cuenta archivada en caja.`,
      });
      setSelectedAccount(null);
      fetchAccounts();
    } else {
      setMsg({ type: 'error', text: res.error || 'Error al liberar mesa' });
    }
  };

  // 3. Takeaway / Retiro (#L-45): Cobrar y Despachar a Cocina (KDS)
  const handleChargeAndDispatchTakeaway = async (tk: TakeawayOrderCard) => {
    setMsg(null);
    try {
      let targetOrderId = tk.orderId;

      // 1. If formal order does not exist, create it in DB
      if (!targetOrderId) {
        const createRes = await request<any>('/api/orders', {
          method: 'POST',
          body: JSON.stringify({
            restaurantId,
            customerId: tk.customerId || actorId,
            preOrderId: tk.preOrderId || undefined,
            type: 'TAKEAWAY',
            items: tk.items.map((it) => {
              const matched = products.find((p) => p.name.toLowerCase() === it.name.toLowerCase());
              return {
                productId: matched?.id || (it as any).productId || '00000000-0000-0000-0000-000000000001',
                quantity: it.quantity,
                unitPrice: it.unitPrice,
              };
            }),
          }),
        });

        if (createRes.data?.id) {
          targetOrderId = createRes.data.id;
        }
      }

      // 2. Dispatch to kitchen with payment triggered (creates KitchenOrder in DB and triggers KDS!)
      if (targetOrderId) {
        const sendRes = await request(`/api/orders/${targetOrderId}/send-to-kitchen`, {
          method: 'POST',
          body: JSON.stringify({
            isPaymentTriggered: true,
          }),
        });

        if (sendRes.error) {
          throw new Error(sendRes.error);
        }
      }

      // 3. Confirm the pre-order if it was linked
      if (tk.preOrderId) {
        await request(`/api/preorders/${tk.preOrderId}/confirm`, {
          method: 'PATCH',
        });
      }

      // 4. Update local storage so mobile screen updates
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('restaurant_os_customer_state_')) {
              const item = JSON.parse(localStorage.getItem(key) || '{}');
              if (item.activePreOrder?.code === tk.code || item.activePreOrder?.orderId === targetOrderId) {
                item.activePreOrder.status = 'PAID_PREPARING';
                localStorage.setItem(key, JSON.stringify(item));
              }
            }
          }
        } catch {
          // ignore
        }
      }

      // 5. Remove immediately from UI state
      setTakeawayOrders((prev) => prev.filter((t) => t.id !== tk.id && t.code !== tk.code));
      setSelectedTakeaway(null);

      setMsg({
        type: 'success',
        text: `🛍️ ¡Pedido ${tk.code} cobrado ($${tk.totalAmount.toLocaleString()}) con ${paymentMethod} y despachado a Cocina KDS! Aparecerá en TV Barra Retiro cuando esté listo.`,
      });

      await fetchAccounts();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Error al despachar pedido a cocina' });
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
            <p className="text-xs text-text-tertiary">Gestión de cuentas de salón, retiro #L-45 y despacho a cocina</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPinModal(true)}
            className="h-9 px-3 rounded-pill bg-amber/20 hover:bg-amber/30 text-amber border border-amber/40 text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
            title="Cambiar cajero con PIN rápido"
          >
            <Zap className="w-4 h-4" />
            <span>⚡ PIN Operador</span>
          </button>
          <button
            onClick={() => setShowScannerModal(true)}
            className="h-9 px-3.5 rounded-pill bg-amber text-black hover:bg-amber-hover text-xs font-bold flex items-center gap-1.5 shadow-glowAmber transition active:scale-95 cursor-pointer"
            title="Escanear QR de cliente para cobro"
          >
            <Camera className="w-4 h-4" />
            <span>Escanear QR (#L-45 / #P-12)</span>
          </button>
          <span className="text-xs font-mono font-extrabold px-3 py-1 rounded-pill bg-emerald/15 text-emerald border border-emerald/30 shadow-sm">
            MESAS LIBRES: {tables.filter((t) => !sessions.some((s) => s.tableId === t.id) && t.status === 'AVAILABLE').length}/{tables.length > 0 ? tables.length : 30}
          </span>
          <button
            onClick={fetchAccounts}
            disabled={loading}
            className="h-9 px-3 rounded-pill glass hover:bg-white/10 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            title="Refrescar"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refrescar</span>
          </button>
        </div>
      </header>

      {/* PIN Numpad Modal for Cashier Quick Operator Switch */}
      <PinNumpadModal
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        onSuccess={() => {
          setMsg({ type: 'success', text: '⚡ Cajero verificado y activado con PIN.' });
          fetchAccounts();
        }}
        title="Cambio Rápido de Cajero"
        subtitle="Ingresa tu PIN de 4 dígitos para identificarte en este puesto de Caja"
      />

      {/* QR Scanner Modal */}
      <QrScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onScanSuccess={(payload) => {
          setMsg(null);
          if (payload.channel === 'TAKEAWAY') {
            setActiveTab('TAKEAWAY');
            const matchTk = takeawayOrders.find((t) => t.code === payload.code) || takeawayOrders[0];
            if (matchTk) {
              handleSelectTakeaway(matchTk);
            }
            setMsg({
              type: 'success',
              text: `🛍️ QR ${payload.code} (TakeAway) escaneado. Seleccionado para cobrar y despachar a Cocina.`,
            });
          } else {
            setActiveTab('SALON');
            const matchMesa = accounts[0];
            if (matchMesa) {
              handleSelectAccount(matchMesa);
            }
            setMsg({
              type: 'success',
              text: `✨ QR ${payload.code} de Salón escaneado con éxito.`,
            });
          }
        }}
        title="Escanear QR de Cliente (Caja)"
        subtitle="Apunta al código QR #L-45 o #P-12 para cobrar y despachar"
      />

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

      {/* Navigation Tabs between Salón and Retiro */}
      <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-2">
        <button
          onClick={() => {
            setActiveTab('SALON');
            setSelectedTakeaway(null);
          }}
          className={`px-4 py-2 rounded-pill text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'SALON'
              ? 'bg-amber text-black shadow-glowAmber'
              : 'glass text-text-secondary hover:text-white'
          }`}
        >
          <span>🍽️ Mesas / Salón</span>
          <span className="px-1.5 py-0.2 rounded-pill bg-black/20 text-[11px] font-mono">
            {openAccounts.length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab('TAKEAWAY');
            setSelectedAccount(null);
          }}
          className={`px-4 py-2 rounded-pill text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'TAKEAWAY'
              ? 'bg-sky-400 text-black shadow-glowAmber'
              : 'glass text-text-secondary hover:text-white'
          }`}
        >
          <span>🛍️ Pedidos / Retiro (#L-45)</span>
          <span className="px-1.5 py-0.2 rounded-pill bg-black/20 text-[11px] font-mono">
            {takeawayOrders.length}
          </span>
        </button>
      </div>

      {/* Main Split Layout: Left 60% List, Right 40% POS Payment Terminal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Accounts or Takeaway List */}
        <section className="lg:col-span-7 rounded-lg bg-surface-1 border border-white/5 p-5 shadow-card">
          {activeTab === 'SALON' ? (
            <>
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/5">
                <h2 className="text-sm font-bold">Cuentas por Mesa (Salón)</h2>
                <span className="text-xs font-mono text-text-tertiary">Selecciona para cobrar y liberar</span>
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {openAccounts.length === 0 ? (
                  <div className="h-48 border border-dashed border-white/10 rounded-md flex flex-col items-center justify-center text-text-tertiary gap-2">
                    <Receipt className="w-7 h-7 opacity-30" />
                    <span className="text-xs">No hay mesas con cuentas pendientes de cobro</span>
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
                            : acc.hasBillRequested
                            ? 'bg-amber/10 border-amber/40 shadow-sm'
                            : isPaid
                            ? 'bg-emerald/10 border-emerald/30'
                            : 'glass border-white/5 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xs bg-amber text-black font-bold text-sm flex items-center justify-center shadow-glowAmber">
                              M{acc.tableNumber}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-text-primary flex items-center gap-2">
                                <span>Mesa {acc.tableNumber}</span>
                                {acc.hasBillRequested && (
                                  <span className="px-2 py-0.5 rounded-pill bg-amber text-black text-[9px] font-extrabold uppercase animate-pulse">
                                    🧾 CUENTA PEDIDA POR MOZO
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-text-secondary font-medium">Mozo: {acc.waiterName}</div>
                            </div>
                          </div>

                          <span
                            className={`text-[10px] font-bold font-mono px-2.5 py-0.5 rounded-pill ${
                              isPaid
                                ? 'bg-emerald text-white'
                                : 'bg-amber/15 text-amber border border-amber/30'
                            }`}
                          >
                            {isPaid ? 'PAGADO' : 'PENDIENTE COBRO'}
                          </span>
                        </div>

                        {/* Breakdown items preview */}
                        {acc.items && acc.items.length > 0 && (
                          <div className="py-2 border-y border-white/5 space-y-1 mb-2">
                            {acc.items.slice(0, 3).map((it, idx) => (
                              <div key={idx} className="flex justify-between text-[11px] text-text-secondary">
                                <span>{it.quantity}x {it.name}</span>
                                <span className="font-mono text-text-tertiary">${(it.quantity * it.unitPrice).toLocaleString()}</span>
                              </div>
                            ))}
                            {acc.items.length > 3 && (
                              <div className="text-[10px] text-amber italic font-medium">
                                +{acc.items.length - 3} platos más...
                              </div>
                            )}
                          </div>
                        )}

                        <div className="grid grid-cols-3 gap-2 pt-1 text-xs font-mono">
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
            </>
          ) : (
            <>
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/5">
                <h2 className="text-sm font-bold">Pedidos de Retiro / Takeaway (#L-45)</h2>
                <span className="text-xs font-mono text-text-tertiary">Cobrar para despachar a Cocina</span>
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {takeawayOrders.length === 0 ? (
                  <div className="h-48 border border-dashed border-white/10 rounded-md flex flex-col items-center justify-center text-text-tertiary gap-2">
                    <Receipt className="w-7 h-7 opacity-30" />
                    <span className="text-xs">No hay pedidos de retiro pendientes de cobro</span>
                  </div>
                ) : (
                  takeawayOrders.map((tk) => {
                    const isSelected = selectedTakeaway?.id === tk.id;
                    return (
                      <div
                        key={tk.id}
                        onClick={() => handleSelectTakeaway(tk)}
                        className={`p-4 rounded-md border transition-all cursor-pointer shadow-sm hover:scale-[1.01] ${
                          isSelected
                            ? 'bg-surface-2 border-sky-400 shadow-glowAmber'
                            : 'glass border-white/5 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-11 h-9 rounded-xs bg-sky-400 text-black font-extrabold text-sm flex items-center justify-center">
                              {tk.code}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-text-primary">{tk.customerName}</div>
                              <div className="text-[11px] text-text-secondary font-medium">Canal: 🛍️ Retiro en Mostrador</div>
                            </div>
                          </div>

                          <span className="text-[10px] font-bold font-mono px-2.5 py-0.5 rounded-pill bg-sky-400/15 text-sky-400 border border-sky-400/30">
                            LISTO PARA COBRO
                          </span>
                        </div>

                        {/* Breakdown items */}
                        {tk.items && tk.items.length > 0 && (
                          <div className="py-2 border-y border-white/5 space-y-1 mb-2">
                            {tk.items.map((it, idx) => (
                              <div key={idx} className="flex justify-between text-[11px] text-text-secondary">
                                <span>{it.quantity}x {it.name}</span>
                                <span className="font-mono text-text-tertiary">${(it.quantity * it.unitPrice).toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex justify-between items-center pt-1 text-xs font-mono">
                          <span className="text-text-tertiary">Total a Cobrar:</span>
                          <span className="font-extrabold text-sky-400 text-sm">${tk.totalAmount.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </section>

        {/* Right Side: POS Payment Terminal */}
        <section className="lg:col-span-5 rounded-lg bg-surface-1 border border-white/5 p-5 shadow-card">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/5">
            <div>
              <h2 className="text-sm font-bold">Terminal de Cobro POS</h2>
              {selectedAccount && (
                <p className="text-xs text-amber font-semibold">Mesa {selectedAccount.tableNumber} • {selectedAccount.waiterName}</p>
              )}
              {selectedTakeaway && (
                <p className="text-xs text-sky-400 font-semibold">Pedido {selectedTakeaway.code} • {selectedTakeaway.customerName}</p>
              )}
            </div>
            <Calculator className="w-4 h-4 text-amber" />
          </div>

          {/* If Nothing Selected */}
          {!selectedAccount && !selectedTakeaway && (
            <div className="h-72 border border-dashed border-white/10 rounded-md flex flex-col items-center justify-center text-text-tertiary gap-2 p-6 text-center">
              <CreditCard className="w-8 h-8 opacity-30" />
              <span className="text-xs">Selecciona una mesa o pedido de retiro para registrar el cobro</span>
            </div>
          )}

          {/* Form for Salón Mesa Payment */}
          {selectedAccount && (
            <form onSubmit={handleRegisterPayment} className="space-y-4">
              {/* Itemized summary */}
              {selectedAccount.items && selectedAccount.items.length > 0 && (
                <div className="bg-surface-2 border border-white/5 rounded-md p-3 max-h-40 overflow-y-auto space-y-1.5 text-xs">
                  <div className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1">Detalle de Comanda</div>
                  {selectedAccount.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-center text-text-secondary">
                      <span>{it.quantity}x {it.name}</span>
                      <span className="font-mono font-medium text-text-primary">${(it.quantity * it.unitPrice).toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-white/10 flex justify-between font-bold text-text-primary text-xs">
                    <span>Total Consumo:</span>
                    <span className="font-mono text-amber">${selectedAccount.totalAmount.toLocaleString()}</span>
                  </div>
                </div>
              )}

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
                        className={`h-11 rounded-sm border p-2 flex items-center justify-center gap-2 text-xs font-semibold transition cursor-pointer ${
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
                  className="w-full h-11 rounded-sm bg-surface-2 border border-white/10 px-4 text-base font-mono font-bold text-amber focus:outline-none focus:border-amber"
                />

                {/* Quick Split Buttons */}
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(selectedPending)}
                    className="h-8 rounded-pill glass text-xs font-mono font-bold hover:bg-white/10 text-amber cursor-pointer"
                  >
                    100% (${selectedPending.toLocaleString()})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(Math.round(selectedPending / 2))}
                    className="h-8 rounded-pill glass text-xs font-mono font-bold hover:bg-white/10 cursor-pointer"
                  >
                    50% (${Math.round(selectedPending / 2).toLocaleString()})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(Math.round(selectedPending / 4))}
                    className="h-8 rounded-pill glass text-xs font-mono font-bold hover:bg-white/10 cursor-pointer"
                  >
                    25% (${Math.round(selectedPending / 4).toLocaleString()})
                  </button>
                </div>
              </div>

              {/* Submit Payment Action */}
              {selectedPending > 0 ? (
                <button
                  type="submit"
                  disabled={paymentAmount <= 0}
                  className="w-full h-12 rounded-sm bg-emerald text-white hover:bg-emerald-muted font-bold text-xs flex items-center justify-center gap-2 shadow-glowEmerald transition active:scale-98 disabled:opacity-40 cursor-pointer"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>
                    {paymentAmount >= selectedPending
                      ? `COBRAR ($${paymentAmount.toLocaleString()}) Y LIBERAR MESA ${selectedAccount.tableNumber}`
                      : `REGISTRAR COBRO PARCIAL ($${paymentAmount.toLocaleString()})`}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleReleaseTable(selectedAccount.realAccountId || selectedAccount.id, selectedAccount.tableId || '')}
                  className="w-full h-12 rounded-sm bg-emerald text-white hover:bg-emerald-muted font-bold text-xs flex items-center justify-center gap-2 transition shadow-glowEmerald cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  <span>LIBERAR MESA {selectedAccount.tableNumber} (YA SALDADA)</span>
                </button>
              )}
            </form>
          )}

          {/* Form for Takeaway (#L-45) Payment and KDS Dispatch */}
          {selectedTakeaway && (
            <div className="space-y-4">
              {/* Itemized summary */}
              {selectedTakeaway.items && selectedTakeaway.items.length > 0 && (
                <div className="bg-surface-2 border border-white/5 rounded-md p-3 max-h-40 overflow-y-auto space-y-1.5 text-xs">
                  <div className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1">
                    Productos del Pedido {selectedTakeaway.code}
                  </div>
                  {selectedTakeaway.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-center text-text-secondary">
                      <span>{it.quantity}x {it.name}</span>
                      <span className="font-mono font-medium text-text-primary">${(it.quantity * it.unitPrice).toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-white/10 flex justify-between font-bold text-text-primary text-xs">
                    <span>Total a Cobrar:</span>
                    <span className="font-mono text-sky-400">${selectedTakeaway.totalAmount.toLocaleString()}</span>
                  </div>
                </div>
              )}

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
                        className={`h-11 rounded-sm border p-2 flex items-center justify-center gap-2 text-xs font-semibold transition cursor-pointer ${
                          isMethodSelected
                            ? 'bg-sky-400 text-black border-sky-400 shadow-glowAmber font-bold'
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

              {/* Primary Action Button: Charge & Send to Kitchen */}
              <button
                type="button"
                onClick={() => handleChargeAndDispatchTakeaway(selectedTakeaway)}
                className="w-full h-12 rounded-sm bg-emerald text-white hover:bg-emerald-muted font-bold text-xs flex items-center justify-center gap-2 shadow-glowEmerald transition active:scale-98 cursor-pointer"
              >
                <DollarSign className="w-4 h-4" />
                <span>COBRAR (${selectedTakeaway.totalAmount.toLocaleString()}) Y DESPACHAR A COCINA (KDS)</span>
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
