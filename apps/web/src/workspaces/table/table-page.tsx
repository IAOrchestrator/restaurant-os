import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import { useAppContext } from '../../hooks/useContextState';
import { useSse } from '../../hooks/useSse';
import {
  Bell,
  Receipt,
  UtensilsCrossed,
  Plus,
  Minus,
  Send,
  Sparkles,
  ShoppingBag,
  Clock,
  CheckCircle,
  AlertCircle,
  Tablet,
} from 'lucide-react';

export interface CatalogCategory {
  id: string;
  name: string;
  displayOrder: number;
}

export interface CatalogProduct {
  id: string;
  categoryId: string;
  name: string;
  price: number;
  description?: string;
  available: boolean;
}

export interface TableSessionDetail {
  id: string;
  restaurantId: string;
  tableId: string;
  status: 'OPEN' | 'BILL_REQUESTED' | 'CLOSED';
}

export function TablePage() {
  const { restaurantId, actorId, authToken } = useAppContext();
  const { request } = useApi();

  const [session, setSession] = useState<TableSessionDetail | null>(null);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<Array<{ product: CatalogProduct; quantity: number; notes: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [serviceMsg, setServiceMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const deviceId = actorId;

  const fetchSessionAndMenu = useCallback(async () => {
    setLoading(true);
    // 1. Resolve table session for this device
    const sessionRes = await request<TableSessionDetail>(`/api/table-devices/${deviceId}/session`);
    if (sessionRes.data) {
      setSession(sessionRes.data);
    } else {
      setSession(null);
    }

    // 2. Fetch Categories and Products
    const [catRes, prodRes] = await Promise.all([
      request<CatalogCategory[]>(`/api/catalog/categories?restaurantId=${restaurantId}`),
      request<CatalogProduct[]>(`/api/catalog/products?restaurantId=${restaurantId}`),
    ]);

    if (catRes.data) {
      setCategories(catRes.data);
      if (!selectedCategory && catRes.data.length > 0) {
        setSelectedCategory(catRes.data[0].id);
      }
    }
    if (prodRes.data) {
      setProducts(prodRes.data.filter((p) => p.available));
    }
    setLoading(false);
  }, [request, deviceId, restaurantId, selectedCategory]);

  useEffect(() => {
    fetchSessionAndMenu();
  }, [fetchSessionAndMenu]);

  // Real-time updates
  useSse({
    token: authToken,
    eventTypes: [
      'TABLE_ASSIGNED',
      'ORDER_CONFIRMED',
      'ORDER_SENT_TO_KITCHEN',
      'ORDER_READY',
      'ORDER_DELIVERED',
      'ACCOUNT_REQUESTED',
      'PAYMENT_REGISTERED',
      'ACCOUNT_CLOSED',
      'TABLE_CLOSED',
    ],
    onEvent: () => {
      fetchSessionAndMenu();
    },
    onReconnect: () => {
      fetchSessionAndMenu();
    },
  });

  const addToCart = (product: CatalogProduct) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...prev, { product, quantity: 1, notes: '' }];
    });
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as Array<{ product: CatalogProduct; quantity: number; notes: string }>,
    );
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const handleCallWaiter = async () => {
    setServiceMsg(null);
    const res = await request('/api/service/tasks', {
      method: 'POST',
      body: JSON.stringify({
        restaurantId,
        type: 'CALL_WAITER',
        tableSessionId: session?.id,
        notes: 'Mesa solicitó asistencia de mozo.',
      }),
    });

    if (res.data) {
      setServiceMsg({ type: 'success', text: '🔔 El mozo ha sido notificado y se acerca a tu mesa.' });
    } else {
      setServiceMsg({ type: 'error', text: res.error || 'Error al llamar al mozo.' });
    }
  };

  const handleRequestBill = async () => {
    setServiceMsg(null);
    const res = await request('/api/service/tasks', {
      method: 'POST',
      body: JSON.stringify({
        restaurantId,
        type: 'CHECK_ACCOUNT',
        tableSessionId: session?.id,
        notes: 'Mesa solicitó la cuenta.',
      }),
    });

    if (res.data) {
      setServiceMsg({ type: 'success', text: '🧾 Solicitud de cuenta enviada a caja.' });
    } else {
      setServiceMsg({ type: 'error', text: res.error || 'Error al pedir la cuenta.' });
    }
  };

  const handleSendOrder = async () => {
    if (!session || cart.length === 0) return;
    setServiceMsg(null);

    const payload = {
      restaurantId,
      tableSessionId: session.id,
      items: cart.map((item) => ({
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
      // Send directly to kitchen
      await request(`/api/orders/${(res.data as any).id}/send-to-kitchen`, {
        method: 'POST',
      });
      setServiceMsg({ type: 'success', text: '🎉 ¡Tu pedido fue enviado a la cocina con éxito!' });
      setCart([]);
    } else {
      setServiceMsg({ type: 'error', text: res.error || 'Error al enviar pedido.' });
    }
  };

  const filteredProducts = products.filter((p) => {
    if (!selectedCategory) return true;
    return p.categoryId === selectedCategory;
  });

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col lg:flex-row">
      {/* Sidebar Categorías & Acciones */}
      <aside className="w-full lg:w-[240px] glass border-r border-white/5 p-4 flex flex-col justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2.5 mb-6 px-1">
            <div className="w-8 h-8 rounded-sm bg-amber text-black flex items-center justify-center font-bold shadow-glowAmber">
              <Tablet className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-text-tertiary font-bold">Auto-Servicio</div>
              <div className="text-sm font-bold">{session ? 'Mesa Activa' : 'Tablet en Mesa'}</div>
            </div>
          </div>

          <div className="text-[11px] uppercase tracking-widest text-text-tertiary font-semibold mb-3 px-1">
            Categorías
          </div>
          <div className="space-y-1.5 flex flex-row lg:flex-col overflow-x-auto pb-2 lg:pb-0 scrollbar-none">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`h-10 px-3.5 rounded-sm flex items-center gap-2 text-xs font-medium transition text-left shrink-0 ${
                  selectedCategory === c.id
                    ? 'bg-amber text-black font-bold shadow-glowAmber'
                    : 'text-text-secondary hover:bg-white/5 hover:text-white'
                }`}
              >
                <span>{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Action buttons (Bottom of sidebar on desktop) */}
        <div className="pt-6 border-t border-white/5 space-y-2.5 mt-4">
          <button
            onClick={handleCallWaiter}
            className="w-full h-11 rounded-sm glass hover:bg-white/10 text-xs font-semibold flex items-center justify-center gap-2 transition active:scale-95"
          >
            <Bell className="w-4 h-4 text-amber" />
            <span>Llamar al Mozo</span>
          </button>
          <button
            onClick={handleRequestBill}
            className="w-full h-11 rounded-sm border border-white/10 hover:bg-white/5 text-xs font-semibold flex items-center justify-center gap-2 text-text-secondary hover:text-white transition active:scale-95"
          >
            <Receipt className="w-4 h-4" />
            <span>Pedir la Cuenta</span>
          </button>
        </div>
      </aside>

      {/* Main Catalog Grid */}
      <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
        {/* Service Feedback Toast */}
        {serviceMsg && (
          <div
            className={`p-3.5 rounded-md mb-5 text-xs font-medium flex items-center gap-2.5 shadow-card animate-slide-in ${
              serviceMsg.type === 'success'
                ? 'bg-emerald/15 border border-emerald/30 text-emerald'
                : 'bg-crimson/15 border border-crimson/30 text-crimson'
            }`}
          >
            {serviceMsg.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{serviceMsg.text}</span>
          </div>
        )}

        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Menú Interactivo en Mesa</h2>
            <p className="text-xs text-text-tertiary">Selecciona tus platos y envíalos directo a la cocina</p>
          </div>
          <span className="text-xs font-mono text-text-tertiary">{filteredProducts.length} opciones</span>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="h-64 border border-dashed border-white/10 rounded-lg flex flex-col items-center justify-center text-text-tertiary gap-2">
            <UtensilsCrossed className="w-8 h-8 opacity-30" />
            <span className="text-xs">No hay productos en esta categoría</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredProducts.map((dish) => (
              <div
                key={dish.id}
                className="group glass rounded-md overflow-hidden hover:border-white/20 transition-all flex flex-col justify-between shadow-card hover:scale-[1.01]"
              >
                {/* 16:9 Image / Placeholder Header */}
                <div className="aspect-[16/9] bg-surface-2 relative flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="text-2xl opacity-40 group-hover:scale-110 transition duration-300">🍽️</div>
                  <span className="absolute top-2.5 left-2.5 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-pill bg-amber text-black font-bold shadow-sm">
                    Recomendado
                  </span>
                </div>

                {/* Card Body */}
                <div className="p-4 flex flex-col justify-between flex-1">
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <h3 className="text-sm font-bold text-text-primary leading-tight">{dish.name}</h3>
                      <span className="text-mono text-amber text-sm font-bold">${dish.price.toLocaleString()}</span>
                    </div>
                    {dish.description && (
                      <p className="text-xs text-text-secondary line-clamp-2 mt-1 leading-relaxed">
                        {dish.description}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => addToCart(dish)}
                    className="mt-4 w-full h-10 rounded-sm bg-surface-2 group-hover:bg-amber group-hover:text-black font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-98"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar al Pedido</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Carrito Lateral Sticky */}
      <aside className="w-full lg:w-[320px] glass border-l border-white/5 p-4 flex flex-col shrink-0 shadow-card">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-amber" />
            <h3 className="text-xs uppercase tracking-widest font-bold">Tu Pedido</h3>
          </div>
          <span className="text-xs font-mono text-text-tertiary">
            {cart.reduce((a, b) => a + b.quantity, 0)} ítems
          </span>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto max-h-[400px] lg:max-h-none mb-4 pr-1">
          {cart.length === 0 ? (
            <div className="h-40 border border-dashed border-white/10 rounded-md flex flex-col items-center justify-center text-text-tertiary gap-2">
              <ShoppingBag className="w-6 h-6 opacity-30" />
              <span className="text-xs">Tu pedido está vacío</span>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product.id} className="rounded-xs bg-surface-1 border border-white/5 p-3 flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold text-text-primary">{item.product.name}</span>
                  <span className="text-mono text-xs font-bold text-amber">
                    ${(item.product.price * item.quantity).toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-white/5">
                  <span className="text-[11px] text-text-tertiary font-mono">${item.product.price} c/u</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateCartQty(item.product.id, -1)}
                      className="w-6 h-6 rounded bg-surface-2 flex items-center justify-center text-xs hover:bg-white/20"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-5 text-center font-mono text-xs font-bold">{item.quantity}</span>
                    <button
                      onClick={() => updateCartQty(item.product.id, 1)}
                      className="w-6 h-6 rounded bg-surface-2 flex items-center justify-center text-xs hover:bg-white/20"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Total & Send Button */}
        <div className="pt-3 border-t border-white/5 space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-text-secondary">Subtotal</span>
            <span className="text-mono text-base font-bold text-text-primary">${cartTotal.toLocaleString()}</span>
          </div>

          <button
            onClick={handleSendOrder}
            disabled={cart.length === 0}
            className="w-full h-12 rounded-sm bg-amber text-black hover:bg-amber-hover font-bold text-xs flex items-center justify-center gap-2 shadow-glowAmber transition active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            <span>ENVIAR A COCINA (${cartTotal.toLocaleString()})</span>
          </button>
          <p className="text-[10px] text-center text-text-tertiary">
            <Clock className="w-3 h-3 inline mr-1" />
            Tiempo estimado de preparación: 12–18 min
          </p>
        </div>
      </aside>
    </div>
  );
}
