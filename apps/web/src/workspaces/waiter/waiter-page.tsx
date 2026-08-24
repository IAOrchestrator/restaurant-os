import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import { useAppContext } from '../../hooks/useContextState';
import { useSse } from '../../hooks/useSse';
import {
  Bell,
  Utensils,
  Plus,
  Minus,
  Send,
  UserCheck,
  ArrowRightLeft,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Receipt,
  Lock,
  DollarSign,
  CheckCircle2,
} from 'lucide-react';

export interface TableSessionItem {
  id: string;
  restaurantId: string;
  tableId: string;
  status: 'OPEN' | 'BILL_REQUESTED' | 'CLOSED';
  currentWaiterId: string;
  customerIds: string[];
}

export interface TableItem {
  id: string;
  number: number;
  capacity: number;
  status: 'AVAILABLE' | 'ASSIGNED' | 'OCCUPIED';
}

export interface StaffItem {
  id: string;
  name: string;
  roles: string[];
}

export interface CatalogCategory {
  id: string;
  name: string;
  displayOrder?: number;
}

export interface CatalogProduct {
  id: string;
  name: string;
  price: number;
  description?: string | null;
  isAvailable?: boolean;
  available?: boolean;
  categoryId?: string;
  categoryName?: string;
}

export interface ServiceTaskItem {
  id: string;
  type: 'CALL_WAITER' | 'DELIVER_ORDER' | 'REQUEST_BILL' | 'CHECK_ACCOUNT';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  tableSessionId?: string;
  notes?: string;
}

export function WaiterPage() {
  const { restaurantId, actorId, authToken } = useAppContext();
  const { request } = useApi();
  const [sessions, setSessions] = useState<TableSessionItem[]>([]);
  const [tables, setTables] = useState<TableItem[]>([]);
  const [waiters, setWaiters] = useState<StaffItem[]>([]);
  const [categoriesList, setCategoriesList] = useState<CatalogCategory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [tasks, setTasks] = useState<ServiceTaskItem[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Selected table ID (persistent regardless of session changes)
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');

  // Isolated draft cart per table ID
  const [cartsByTable, setCartsByTable] = useState<
    Record<string, Array<{ product: CatalogProduct; quantity: number; notes: string }>>
  >({});

  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [readyAlert, setReadyAlert] = useState<{ taskOrOrderId: string; tableNumber: number; text: string } | null>(
    null,
  );
  const [isHandoverOpen, setIsHandoverOpen] = useState(false);
  const [targetWaiterId, setTargetWaiterId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Active waiter in this terminal
  const [currentWaiterId, setCurrentWaiterId] = useState<string>(actorId || '');
  const [tableFilter, setTableFilter] = useState<'MINE' | 'ALL'>('MINE');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sessionsRes, tablesRes, staffRes, categoriesRes, productsRes, tasksRes, ordersRes, accountsRes] =
        await Promise.all([
          request<TableSessionItem[]>(`/api/table-sessions?restaurantId=${restaurantId}`),
          request<TableItem[]>(`/api/tables?restaurantId=${restaurantId}`),
          request<StaffItem[]>(`/api/staff?restaurantId=${restaurantId}&role=WAITER`),
          request<CatalogCategory[]>(`/api/catalog/categories?restaurantId=${restaurantId}`),
          request<CatalogProduct[]>(`/api/catalog/products?restaurantId=${restaurantId}`),
          request<ServiceTaskItem[]>(`/api/service/tasks?restaurantId=${restaurantId}`),
          request<any[]>(`/api/orders?restaurantId=${restaurantId}`),
          request<any[]>(`/api/billing/accounts?restaurantId=${restaurantId}`),
        ]);

      const catMap: Record<string, string> = {};
      if (categoriesRes.data) {
        setCategoriesList(categoriesRes.data);
        categoriesRes.data.forEach((c) => {
          catMap[c.id] = c.name;
        });
      }

      if (sessionsRes.data) {
        const activeSessions = sessionsRes.data.filter((s) => s.status !== 'CLOSED');
        setSessions(activeSessions);
      }
      if (tablesRes.data) {
        const sortedTables = tablesRes.data.sort((a, b) => a.number - b.number);
        setTables(sortedTables);
        if (!selectedTableId && sortedTables.length > 0) {
          setSelectedTableId(sortedTables[0].id);
        }
      }
      if (staffRes.data) setWaiters(staffRes.data);
      if (ordersRes.data) setOrders(ordersRes.data.filter((o) => o.status !== 'CANCELLED'));
      if (accountsRes.data) setAccounts(accountsRes.data);
      if (productsRes.data) {
        const mappedProducts = productsRes.data
          .filter((p: any) => p.isAvailable !== false && p.available !== false)
          .map((p: any) => ({
            ...p,
            categoryName: catMap[p.categoryId] || 'General',
          }));
        setProducts(mappedProducts);
      }
      if (tasksRes.data) setTasks(tasksRes.data.filter((t) => t.status !== 'COMPLETED'));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [request, restaurantId, selectedTableId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sync waiter terminal
  useEffect(() => {
    if (actorId && actorId !== currentWaiterId) {
      setCurrentWaiterId(actorId);
    }
  }, [actorId, currentWaiterId]);

  // Real-time SSE
  useSse({
    token: authToken,
    eventTypes: [
      'TABLE_ASSIGNED',
      'TABLE_CHANGED',
      'TABLE_RELEASED',
      'WAITER_CHANGED',
      'ORDER_CONFIRMED',
      'ORDER_SENT_TO_KITCHEN',
      'ORDER_NEARLY_READY',
      'ORDER_READY',
      'ORDER_DELIVERED',
      'SERVICE_TASK_CREATED',
      'PAYMENT_REGISTERED',
      'TABLE_CLOSED',
      'ACCOUNT_CLOSED',
    ],
    onEvent: (event) => {
      fetchData();
      if (event.type === 'ORDER_READY') {
        const tableNum = (event.payload as any)?.tableNumber || 1;
        setReadyAlert({
          taskOrOrderId: (event.payload as any)?.orderId || 'order-1',
          tableNumber: tableNum,
          text: `¡Plato Listo para Mesa ${tableNum}!`,
        });
      }
    },
    onReconnect: () => {
      fetchData();
    },
  });

  const waiterMap = (waiters || []).reduce<Record<string, string>>((acc, w) => {
    acc[w.id] = w.name;
    return acc;
  }, {});

  const sessionByTableId = (sessions || []).reduce<Record<string, TableSessionItem>>((acc, s) => {
    acc[s.tableId] = s;
    return acc;
  }, {});

  const activeWaiter = (waiters || []).find((w) => w.id === currentWaiterId) || waiters[0];

  const handleSelectWaiterTerminal = (waiterId: string) => {
    setCurrentWaiterId(waiterId);
  };

  // Selected table & session context
  const selectedTable = tables.find((t) => t.id === selectedTableId) || tables[0];
  const selectedSession = selectedTable ? sessionByTableId[selectedTable.id] : null;

  // Selected session active consumption
  const sessionOrders = selectedSession
    ? (orders || []).filter((o) => o.tableSessionId === selectedSession.id)
    : [];

  const sessionAccount = selectedSession
    ? (accounts || []).find((a) => a.tableSessionId === selectedSession.id && a.status !== 'CLOSED')
    : null;

  const totalConsumption =
    sessionAccount?.totalAmount ?? sessionOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const paidAmount = sessionAccount?.paidAmount ?? 0;
  const isFullyPaidInCashier =
    Boolean(sessionAccount) && (sessionAccount.status === 'PAID' || (totalConsumption > 0 && paidAmount >= totalConsumption));

  const hasConsumption = sessionOrders.length > 0 || totalConsumption > 0;

  // Current draft cart for selected table
  const currentCart = selectedTable ? cartsByTable[selectedTable.id] || [] : [];
  const cartTotal = currentCart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  // Categories list
  const categories = [
    'Todos',
    ...categoriesList.map((c) => c.name),
    ...Array.from(new Set(products.map((p) => p.categoryName || 'General'))).filter(
      (name) => !categoriesList.some((c) => c.name === name),
    ),
  ];

  const filteredProducts = products.filter((p) => {
    if (selectedCategory === 'Todos') return true;
    return (p.categoryName || 'General') === selectedCategory;
  });

  // Cart operations per table
  const addToCart = (product: CatalogProduct) => {
    if (!selectedTable) return;
    setCartsByTable((prev) => {
      const tableCart = prev[selectedTable.id] || [];
      const existing = tableCart.find((item) => item.product.id === product.id);
      let updatedCart;
      if (existing) {
        updatedCart = tableCart.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      } else {
        updatedCart = [...tableCart, { product, quantity: 1, notes: '' }];
      }
      return { ...prev, [selectedTable.id]: updatedCart };
    });
  };

  const updateCartQty = (productId: string, delta: number) => {
    if (!selectedTable) return;
    setCartsByTable((prev) => {
      const tableCart = prev[selectedTable.id] || [];
      const updatedCart = tableCart
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as Array<{ product: CatalogProduct; quantity: number; notes: string }>;
      return { ...prev, [selectedTable.id]: updatedCart };
    });
  };

  // Open Table Session (Occupy table)
  const handleOpenTable = async (tableId: string) => {
    setMsg(null);
    setIsProcessing(true);
    const res = await request<TableSessionItem>('/api/table-sessions', {
      method: 'POST',
      body: JSON.stringify({
        restaurantId,
        tableId,
        initialWaiterId: currentWaiterId,
      }),
    });
    setIsProcessing(false);

    if (res.data) {
      setMsg({ type: 'success', text: `✨ Mesa #${selectedTable?.number} ocupada para comanda.` });
      fetchData();
    } else {
      setMsg({ type: 'error', text: res.error || 'Error al abrir mesa' });
    }
  };

  // Submit Comanda
  const handleSendToKitchen = async () => {
    if (!selectedTable || currentCart.length === 0) return;
    setMsg(null);

    // If table session doesn't exist yet, open it automatically
    let targetSessionId = selectedSession?.id;
    if (!targetSessionId) {
      const openRes = await request<TableSessionItem>('/api/table-sessions', {
        method: 'POST',
        body: JSON.stringify({
          restaurantId,
          tableId: selectedTable.id,
          initialWaiterId: currentWaiterId,
        }),
      });
      if (openRes.data) {
        targetSessionId = openRes.data.id;
      } else {
        setMsg({ type: 'error', text: openRes.error || 'Error al iniciar sesión de mesa' });
        return;
      }
    }

    const payload = {
      restaurantId,
      tableSessionId: targetSessionId,
      items: currentCart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        unitPrice: item.product.price,
        notes: item.notes || undefined,
      })),
    };

    const res = await request('/api/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.data) {
      await request(`/api/orders/${(res.data as any).id}/send-to-kitchen`, {
        method: 'POST',
      });
      setMsg({ type: 'success', text: `¡Comanda enviada a cocina para Mesa ${selectedTable.number}!` });
      // Clear cart for this table
      setCartsByTable((prev) => {
        const copy = { ...prev };
        delete copy[selectedTable.id];
        return copy;
      });
      fetchData();
    } else {
      setMsg({ type: 'error', text: res.error || 'Error al enviar comanda' });
    }
  };

  // Request Bill to Cashier
  const handleRequestBill = async () => {
    if (!selectedSession) return;
    setMsg(null);
    const res = await request('/api/service/tasks', {
      method: 'POST',
      body: JSON.stringify({
        restaurantId,
        tableSessionId: selectedSession.id,
        type: 'CHECK_ACCOUNT',
        notes: `Mesa ${selectedTable?.number} solicita cuenta por $${totalConsumption.toLocaleString()}`,
      }),
    });
    if (res.data) {
      setMsg({ type: 'success', text: `🧾 Cuenta de Mesa ${selectedTable?.number} derivada a Caja para cobro.` });
      fetchData();
    } else {
      setMsg({ type: 'error', text: res.error || 'Error al derivar cuenta a Caja' });
    }
  };

  // Release table (Without consumption or Paid in Cashier)
  const handleReleaseTable = async () => {
    if (!selectedSession) return;
    setMsg(null);
    setIsProcessing(true);

    // If account exists and is paid, close account too
    if (sessionAccount?.id) {
      await request(`/api/billing/accounts/${sessionAccount.id}/close`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    }

    const res = await request(`/api/table-sessions/${selectedSession.id}/close`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    setIsProcessing(false);

    if (res.data) {
      setMsg({ type: 'success', text: `🔒 Mesa #${selectedTable?.number} liberada y limpia exitosamente.` });
      fetchData();
    } else {
      setMsg({ type: 'error', text: res.error || 'Error al liberar la mesa' });
    }
  };

  // Handover table
  const handleHandover = async () => {
    if (!selectedSession || !targetWaiterId) return;
    const res = await request(`/api/table-sessions/${selectedSession.id}/change-waiter`, {
      method: 'POST',
      body: JSON.stringify({ newWaiterId: targetWaiterId }),
    });
    if (res.data) {
      setMsg({ type: 'success', text: `Mesa traspasada a ${waiterMap[targetWaiterId] || 'otro mozo'}` });
      setIsHandoverOpen(false);
      fetchData();
    } else {
      setMsg({ type: 'error', text: res.error || 'Error en traspaso' });
    }
  };

  return (
    <div className="min-h-screen bg-background text-text-primary p-4 max-w-[480px] mx-auto relative pb-36">
      {/* Ready Alert Top Toast */}
      {readyAlert && (
        <div className="glass-strong border border-emerald/40 rounded-md p-3 mb-4 flex items-center justify-between shadow-glowEmerald animate-slide-in">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald text-white flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider font-bold text-emerald">Plato Listo</div>
              <div className="text-sm font-semibold">{readyAlert.text}</div>
            </div>
          </div>
          <button
            onClick={() => setReadyAlert(null)}
            className="h-8 px-3 rounded-pill bg-emerald text-white text-xs font-bold shadow-sm"
          >
            ENTREGAR
          </button>
        </div>
      )}

      {/* Terminal Header */}
      <header className="glass rounded-lg p-3 mb-4 shadow-card">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xs bg-amber text-black flex items-center justify-center font-bold">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-text-tertiary">Terminal Mozo</div>
              <h2 className="text-sm font-bold">Mozo: {activeWaiter?.name || 'Atención'}</h2>
            </div>
          </div>

          <div className="flex gap-1">
            {waiters.map((w) => (
              <button
                key={w.id}
                onClick={() => handleSelectWaiterTerminal(w.id)}
                className={`h-7 px-2.5 rounded-pill text-xs font-medium transition ${
                  currentWaiterId === w.id
                    ? 'bg-amber text-black font-bold shadow-sm'
                    : 'bg-surface-2 text-text-secondary hover:text-white'
                }`}
              >
                {w.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Toggle & Live Counter */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setTableFilter('MINE')}
              className={`px-3 py-1 rounded-pill font-medium transition ${
                tableFilter === 'MINE' ? 'bg-white text-black font-bold' : 'text-text-secondary hover:text-white'
              }`}
            >
              Mis Mesas ({sessions.filter((s) => s.currentWaiterId === currentWaiterId).length})
            </button>
            <button
              onClick={() => setTableFilter('ALL')}
              className={`px-3 py-1 rounded-pill font-medium transition ${
                tableFilter === 'ALL' ? 'bg-white text-black font-bold' : 'text-text-secondary hover:text-white'
              }`}
            >
              Todas ({tables.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-pill bg-emerald/15 text-emerald border border-emerald/30 shadow-sm">
              LIBRES: {tables.filter((t) => !sessionByTableId[t.id] && t.status === 'AVAILABLE').length}/{tables.length > 0 ? tables.length : 30}
            </span>
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-1 text-text-secondary hover:text-white transition"
              title="Refrescar"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Mesas Chips Slider */}
      <section className="mb-4">
        <div className="text-[11px] uppercase tracking-widest text-text-tertiary font-semibold mb-2">
          Seleccionar Mesa del Salón
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {tables.map((table) => {
            const session = sessionByTableId[table.id];
            const isSelected = selectedTableId === table.id;
            const isMine = session?.currentWaiterId === currentWaiterId;
            const isOccupied = Boolean(session);
            const isTablePaid =
              isOccupied &&
              accounts.some(
                (a) => a.tableSessionId === session?.id && (a.status === 'PAID' || a.paidAmount >= a.totalAmount && a.totalAmount > 0),
              );

            if (tableFilter === 'MINE' && isOccupied && !isMine) {
              return null;
            }

            return (
              <button
                key={table.id}
                onClick={() => setSelectedTableId(table.id)}
                className={`shrink-0 h-10 px-3.5 rounded-pill flex items-center gap-2 text-xs font-semibold border transition active:scale-95 ${
                  isSelected
                    ? 'bg-amber text-black border-amber shadow-glowAmber font-bold'
                    : isTablePaid
                    ? 'bg-emerald/20 text-emerald border-emerald/40'
                    : isOccupied
                    ? 'bg-surface-2 text-text-primary border-amber/30'
                    : 'glass text-text-secondary border-white/5'
                }`}
              >
                <span>Mesa {table.number}</span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    isSelected
                      ? 'bg-black'
                      : isTablePaid
                      ? 'bg-emerald animate-pulse'
                      : isOccupied
                      ? 'bg-amber'
                      : 'bg-emerald/60'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </section>

      {/* Selected Table Actions Bar */}
      {selectedTable && (
        <div className="glass rounded-md p-3.5 mb-4 shadow-card">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold">Mesa {selectedTable.number}</span>
                {isFullyPaidInCashier ? (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-pill bg-emerald text-white shadow-glowEmerald">
                    💰 PAGADA EN CAJA (${totalConsumption.toLocaleString()})
                  </span>
                ) : selectedSession ? (
                  hasConsumption ? (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-pill bg-amber/15 text-amber border border-amber/30">
                      CON CONSUMO (${totalConsumption.toLocaleString()})
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-pill bg-white/10 text-text-secondary">
                      OCUPADA (SIN CONSUMO)
                    </span>
                  )
                ) : (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-pill bg-emerald/15 text-emerald border border-emerald/30">
                    LIBRE / DISPONIBLE
                  </span>
                )}
              </div>
              <div className="text-[11px] text-text-tertiary mt-0.5">
                {selectedSession
                  ? `Mozo a cargo: ${waiterMap[selectedSession.currentWaiterId] || 'Mozo'}`
                  : `Capacidad: ${selectedTable.capacity} comensales`}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5">
              {selectedSession ? (
                <>
                  <button
                    onClick={() => setIsHandoverOpen(true)}
                    className="h-8 px-2.5 rounded-pill glass hover:bg-white/10 text-xs font-semibold flex items-center gap-1 text-text-secondary hover:text-white"
                    title="Traspasar mesa a otro mozo"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Traspasar</span>
                  </button>

                  {isFullyPaidInCashier ? (
                    <button
                      onClick={handleReleaseTable}
                      disabled={isProcessing}
                      className="h-8 px-3 rounded-pill bg-emerald text-white hover:bg-emerald-muted text-xs font-bold flex items-center gap-1.5 shadow-glowEmerald transition active:scale-95"
                      title="Liberar mesa cobrada"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Liberar Mesa</span>
                    </button>
                  ) : !hasConsumption ? (
                    <button
                      onClick={handleReleaseTable}
                      disabled={isProcessing}
                      className="h-8 px-3 rounded-pill bg-crimson/15 border border-crimson/30 hover:bg-crimson/25 text-crimson text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
                      title="El cliente se levantó sin pedir nada"
                    >
                      <span>Liberar Mesa</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleRequestBill}
                      className="h-8 px-3 rounded-pill bg-amber text-black hover:bg-amber-hover text-xs font-bold flex items-center gap-1.5 shadow-glowAmber transition active:scale-95"
                      title="Enviar aviso a Caja para preparar cobro"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>Derivar a Caja</span>
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={() => handleOpenTable(selectedTable.id)}
                  disabled={isProcessing}
                  className="h-8 px-3.5 rounded-pill bg-emerald text-white hover:bg-emerald-muted font-bold text-xs flex items-center gap-1 shadow-glowEmerald transition active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ocupar Mesa</span>
                </button>
              )}
            </div>
          </div>

          {/* Active Orders Summary for Table */}
          {sessionOrders.length > 0 && (
            <div className="mt-2.5 pt-2.5 border-t border-white/5 text-xs">
              <div className="text-[10px] uppercase font-bold tracking-wider text-text-tertiary mb-1">
                Consumos en curso ({sessionOrders.length} comandas):
              </div>
              <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                {sessionOrders.map((ord: any) => (
                  <div
                    key={ord.id}
                    className="flex items-center justify-between text-[11px] bg-surface-2 rounded px-2 py-1"
                  >
                    <span className="truncate max-w-[200px] text-text-secondary">
                      {ord.items
                        ?.map(
                          (i: any) =>
                            `${i.quantity}x ${products.find((p) => p.id === i.productId)?.name || i.productId}`,
                        )
                        .join(', ')}
                    </span>
                    <span
                      className={`font-mono font-bold ${
                        isFullyPaidInCashier
                          ? 'text-emerald'
                          : ord.status === 'DELIVERED'
                          ? 'text-emerald'
                          : 'text-amber'
                      }`}
                    >
                      ${ord.totalAmount?.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Handover Modal */}
      {isHandoverOpen && selectedSession && (
        <div className="glass-strong border border-amber/30 rounded-lg p-4 mb-4 shadow-card animate-slide-in">
          <div className="text-sm font-bold mb-2">Traspasar Mesa {selectedTable?.number}</div>
          <p className="text-xs text-text-secondary mb-3">Selecciona el mozo que tomará la atención:</p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {waiters
              .filter((w) => w.id !== currentWaiterId)
              .map((w) => (
                <button
                  key={w.id}
                  onClick={() => setTargetWaiterId(w.id)}
                  className={`h-9 px-3 rounded-xs text-xs font-semibold border transition ${
                    targetWaiterId === w.id ? 'bg-amber text-black border-amber font-bold' : 'bg-surface-2 border-white/5'
                  }`}
                >
                  {w.name}
                </button>
              ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleHandover}
              disabled={!targetWaiterId}
              className="flex-1 h-9 rounded-pill bg-amber text-black font-bold text-xs disabled:opacity-50"
            >
              Confirmar Traspaso
            </button>
            <button
              onClick={() => setIsHandoverOpen(false)}
              className="h-9 px-4 rounded-pill glass text-xs text-text-secondary"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      {msg && (
        <div
          className={`p-3 rounded-md mb-4 text-xs font-medium flex items-center gap-2 shadow-sm ${
            msg.type === 'success'
              ? 'bg-emerald/15 border border-emerald/30 text-emerald'
              : 'bg-crimson/15 border border-crimson/30 text-crimson'
          }`}
        >
          {msg.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Categories Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-none">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setSelectedCategory(c)}
            className={`shrink-0 h-8 px-3.5 rounded-pill text-xs font-medium transition ${
              selectedCategory === c
                ? 'bg-surface-2 text-white border border-white/20 font-bold'
                : 'text-text-tertiary hover:text-white'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Product Catalog Grid (2 columns) */}
      <div className="grid grid-cols-2 gap-2 mb-6">
        {filteredProducts.map((p) => (
          <button
            key={p.id}
            onClick={() => addToCart(p)}
            className="glass rounded-md p-3 text-left transition active:scale-[0.97] hover:border-white/20 flex flex-col justify-between min-h-[90px] shadow-sm"
          >
            <div>
              <div className="text-xs font-semibold text-text-primary leading-tight line-clamp-2">{p.name}</div>
              {p.description && <div className="text-[10px] text-text-tertiary mt-1 line-clamp-1">{p.description}</div>}
            </div>
            <div className="flex items-center justify-between mt-2 pt-1 border-t border-white/5">
              <span className="text-mono text-amber text-xs font-bold">${p.price.toLocaleString()}</span>
              <div className="w-6 h-6 rounded-full bg-white/10 text-white flex items-center justify-center text-xs font-bold">
                +
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Floating Glass Cart Footer Bar */}
      {currentCart.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 max-w-[448px] mx-auto glass-strong border border-amber/40 rounded-lg p-3 shadow-2xl z-30 animate-slide-in">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-amber" />
              <span className="text-xs font-bold">Comanda Mesa {selectedTable?.number}</span>
              <span className="text-[11px] text-text-tertiary">
                ({currentCart.reduce((a, b) => a + b.quantity, 0)} ítems)
              </span>
            </div>
            <span className="text-mono text-sm font-bold text-amber">${cartTotal.toLocaleString()}</span>
          </div>

          <div className="max-h-28 overflow-y-auto space-y-1.5 mb-3 pr-1">
            {currentCart.map((item) => (
              <div
                key={item.product.id}
                className="flex items-center justify-between bg-surface-2 rounded-xs px-2.5 py-1.5 text-xs"
              >
                <span className="truncate max-w-[160px] font-medium">{item.product.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-mono text-[11px] text-text-secondary">
                    ${(item.product.price * item.quantity).toLocaleString()}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateCartQty(item.product.id, -1)}
                      className="w-5 h-5 rounded bg-white/10 flex items-center justify-center font-bold hover:bg-white/20"
                    >
                      -
                    </button>
                    <span className="w-4 text-center font-mono text-xs">{item.quantity}</span>
                    <button
                      onClick={() => updateCartQty(item.product.id, 1)}
                      className="w-5 h-5 rounded bg-white/10 flex items-center justify-center font-bold hover:bg-white/20"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleSendToKitchen}
            className="w-full h-11 rounded-sm bg-amber text-black hover:bg-amber-hover font-bold text-xs flex items-center justify-center gap-2 shadow-glowAmber transition active:scale-[0.98]"
          >
            <Send className="w-4 h-4" />
            <span>ENVIAR A COCINA (${cartTotal.toLocaleString()})</span>
          </button>
        </div>
      )}
    </div>
  );
}
