import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import { useAppContext } from '../../hooks/useContextState';
import { useSse } from '../../hooks/useSse';
import {
  Sparkles,
  Star,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Flame,
  ShoppingBag,
  Plus,
  Minus,
  Utensils,
  Bike,
  Send,
  MapPin,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { QrCodeVisual } from '../../components/shared/QrCodeVisual';

export interface CatalogProduct {
  id: string;
  name: string;
  price: number;
  description?: string;
  categoryName?: string;
  sectorKDS?: string;
  available: boolean;
}

export interface CartItem {
  product: CatalogProduct;
  quantity: number;
  notes?: string;
}

export function CustomerPage() {
  const { restaurantId, actorId, authToken } = useAppContext();
  const { request } = useApi();

  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [channel, setChannel] = useState<'SALON' | 'TAKEAWAY' | 'DELIVERY'>('SALON');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [activePreOrder, setActivePreOrder] = useState<{
    code: string;
    type: 'SALON' | 'TAKEAWAY' | 'DELIVERY';
    status: string;
    totalAmount: number;
    itemsCount: number;
  } | null>(null);

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewMsg, setReviewMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Restore state from localStorage on mount
  useEffect(() => {
    try {
      const savedKey = `restaurant_os_customer_state_${restaurantId}_${actorId || 'anon'}`;
      const saved = localStorage.getItem(savedKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.cart && Array.isArray(parsed.cart)) setCart(parsed.cart);
        if (parsed.channel) setChannel(parsed.channel);
        if (parsed.deliveryAddress) setDeliveryAddress(parsed.deliveryAddress);
        if (parsed.activePreOrder) setActivePreOrder(parsed.activePreOrder);
      }
    } catch {
      // safe fallback
    }
  }, [restaurantId, actorId]);

  // Persist state to localStorage whenever modified
  useEffect(() => {
    try {
      const savedKey = `restaurant_os_customer_state_${restaurantId}_${actorId || 'anon'}`;
      localStorage.setItem(
        savedKey,
        JSON.stringify({
          cart,
          channel,
          deliveryAddress,
          activePreOrder,
        }),
      );
    } catch {
      // safe fallback
    }
  }, [restaurantId, actorId, cart, channel, deliveryAddress, activePreOrder]);

  const fetchMenu = useCallback(async () => {
    const res = await request<CatalogProduct[]>(`/api/catalog/products?restaurantId=${restaurantId}`);
    if (res.data) {
      const activeProducts = res.data.filter((p: any) => p.isAvailable !== false && p.available !== false);
      setProducts(activeProducts);
      const uniqueCats = Array.from(
        new Set(activeProducts.map((p) => p.categoryName || 'General')),
      );
      setCategories(['Todos', ...uniqueCats]);
    }
  }, [request, restaurantId]);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  // Real-time SSE synchronization
  useSse({
    token: authToken,
    eventTypes: [
      'CUSTOMER_CALLED',
      'CUSTOMER_CONFIRMED',
      'CUSTOMER_SEATED',
      'ORDER_CONFIRMED',
      'ORDER_SENT_TO_KITCHEN',
      'ORDER_READY',
      'ORDER_DELIVERED',
      'PAYMENT_REGISTERED',
      'ACCOUNT_CLOSED',
    ],
    onEvent: (event) => {
      fetchMenu();
      if (event.type === 'ORDER_READY' && activePreOrder) {
        setActivePreOrder((prev) => (prev ? { ...prev, status: 'LISTO_PARA_RETIRAR' } : null));
        setMsg({
          type: 'success',
          text: `✨ ¡Tu pedido ${activePreOrder.code} está listo para retirar en la barra!`,
        });
      }
    },
    onReconnect: () => {
      fetchMenu();
    },
  });

  // Cart operations
  const addToCart = (product: CatalogProduct) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...prev, { product, quantity: 1 }];
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
        .filter(Boolean) as CartItem[],
    );
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  // Submit Pre-Order (Generates Live QR #P-12, #L-45 or #D-45)
  const handleGeneratePreOrder = async () => {
    if (cart.length === 0) return;
    setMsg(null);

    const codePrefix = channel === 'SALON' ? '#P' : (channel === 'TAKEAWAY' ? '#L' : '#D');
    const randomNum = Math.floor(10 + Math.random() * 89);
    const generatedCode = `${codePrefix}-${randomNum}`;

    try {
      // 1. Post Pre-Order to DB
      await request('/api/preorders', {
        method: 'POST',
        body: JSON.stringify({
          restaurantId,
          customerId: actorId,
          items: cart.map((c) => ({
            productId: c.product.id,
            quantity: c.quantity,
          })),
        }),
      });

      // 2. If Takeaway or Delivery, also create the Order so TV Barra and Caja receive it immediately
      if (channel === 'TAKEAWAY' || channel === 'DELIVERY') {
        await request('/api/orders', {
          method: 'POST',
          body: JSON.stringify({
            restaurantId,
            customerId: actorId,
            type: channel,
            items: cart.map((c) => ({
              productId: c.product.id,
              quantity: c.quantity,
              unitPrice: c.product.price,
            })),
          }),
        });
      }
    } catch {
      // Offline fallback
    }

    const preOrderObj = {
      code: generatedCode,
      type: channel,
      status: 'ACTIVO',
      totalAmount: cartTotal,
      itemsCount: cart.reduce((acc, it) => acc + it.quantity, 0),
    };

    setActivePreOrder(preOrderObj);

    setMsg({
      type: 'success',
      text: `✨ ¡Pre-orden generada con éxito! Muestra tu código ${generatedCode} para continuar.`,
    });
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewMsg(null);

    const res = await request('/api/reviews', {
      method: 'POST',
      body: JSON.stringify({
        restaurantId,
        customerId: actorId,
        score: rating,
        comment: comment.trim() || undefined,
      }),
    });

    if (res.error) {
      setReviewMsg({ type: 'error', text: res.error });
    } else {
      setReviewMsg({ type: 'success', text: '⭐ ¡Muchas gracias por tu reseña y calificación!' });
      setComment('');
    }
  };

  const filteredProducts = products.filter((p) => {
    if (selectedCategory === 'Todos') return true;
    return (p.categoryName || 'General') === selectedCategory;
  });

  return (
    <div className="min-h-screen bg-background text-text-primary p-4 max-w-[500px] mx-auto pb-32">
      {/* Header Bar */}
      <header className="glass rounded-lg p-4 mb-5 shadow-card flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-sm bg-amber text-black flex items-center justify-center font-black shadow-glowAmber">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-text-tertiary font-bold">Portal del Comensal</div>
            <div className="text-sm font-bold">Carta Digital & Pre-Orden</div>
          </div>
        </div>
        <div className="text-[11px] font-mono text-emerald bg-emerald/10 border border-emerald/20 px-2.5 py-1 rounded-pill flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse" />
          <span>En Línea</span>
        </div>
      </header>

      {/* Messages */}
      {msg && (
        <div
          className={`p-3.5 rounded-md mb-4 text-xs font-medium flex items-center gap-2.5 shadow-card animate-slide-in ${
            msg.type === 'success'
              ? 'bg-emerald/15 border border-emerald/30 text-emerald'
              : 'bg-crimson/15 border border-crimson/30 text-crimson'
          }`}
        >
          {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Active Live QR Card (If Generated) */}
      {activePreOrder && (
        <section className="rounded-xl bg-gradient-to-br from-amber/20 to-surface-2 border-2 border-amber p-5 mb-6 shadow-glowAmber text-center relative overflow-hidden animate-slide-in">
          <div className="flex items-center justify-between mb-3">
            <span className="px-2.5 py-0.5 rounded-pill bg-amber text-black text-[10px] font-black uppercase tracking-wider">
              {activePreOrder.type === 'SALON' ? '🍽️ Salón' : (activePreOrder.type === 'TAKEAWAY' ? '🛍️ Retiro' : '🛵 Delivery')}
            </span>
            <span className="text-xs font-mono text-emerald font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald animate-ping" />
              <span>QR VIVO ÚNICO</span>
            </span>
          </div>

          {/* Crisp Giant SVG QR Code */}
          <div className="my-3 flex justify-center">
            <QrCodeVisual
              value={JSON.stringify({
                code: activePreOrder.code,
                type: activePreOrder.type,
                restaurantId,
                total: activePreOrder.totalAmount,
              })}
              size={180}
              subLabel={`CÓDIGO: ${activePreOrder.code}`}
            />
          </div>

          <div className="text-3xl font-black font-mono tracking-wider text-white mb-2">
            {activePreOrder.code}
          </div>

          <p className="text-xs text-text-secondary mb-3 px-2">
            {activePreOrder.type === 'SALON'
              ? 'Muestra este código al Mozo o Recepción al sentarte en tu mesa.'
              : (activePreOrder.type === 'TAKEAWAY'
              ? 'Muestra este código en Caja para abonar y luego retira en Barra.'
              : `Enviando a: ${deliveryAddress || 'Domicilio del cliente'}`)}
          </p>

          <div className="flex justify-between items-center bg-black/40 rounded-lg p-2.5 text-xs font-mono">
            <span>{activePreOrder.itemsCount} productos</span>
            <span className="font-bold text-amber">${activePreOrder.totalAmount.toLocaleString()}</span>
          </div>

          {/* Placeholder for Gmail Login */}
          <div className="mt-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={() =>
                setMsg({
                  type: 'success',
                  text: 'ℹ️ Vinculación con Gmail OAuth se habilitará en Fase 3. ¡Tu sesión actual ya funciona sin fricción!',
                })
              }
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-text-secondary hover:text-white bg-surface-2 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-pill transition cursor-pointer"
            >
              <span>✉️ Guardar con Gmail (Próximamente Fase 3)</span>
            </button>
          </div>
        </section>
      )}

      {/* Channel Selector */}
      <section className="mb-4">
        <div className="text-[11px] uppercase tracking-wider text-text-tertiary font-bold mb-2">
          ¿Cómo deseas tu pedido?
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setChannel('SALON')}
            className={`h-11 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              channel === 'SALON'
                ? 'bg-amber text-black shadow-glowAmber'
                : 'glass text-text-secondary hover:text-white'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>Salón</span>
          </button>
          <button
            onClick={() => setChannel('TAKEAWAY')}
            className={`h-11 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              channel === 'TAKEAWAY'
                ? 'bg-amber text-black shadow-glowAmber'
                : 'glass text-text-secondary hover:text-white'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Retiro</span>
          </button>
          <button
            onClick={() => setChannel('DELIVERY')}
            className={`h-11 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              channel === 'DELIVERY'
                ? 'bg-amber text-black shadow-glowAmber'
                : 'glass text-text-secondary hover:text-white'
            }`}
          >
            <Bike className="w-3.5 h-3.5" />
            <span>Delivery</span>
          </button>
        </div>

        {channel === 'DELIVERY' && (
          <div className="mt-3">
            <input
              type="text"
              placeholder="Dirección de entrega (Ej: Av. Corrientes 1234, 4to B)"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              className="w-full h-10 rounded-md bg-surface-2 border border-white/10 px-3 text-xs focus:outline-none focus:border-amber"
            />
          </div>
        )}
      </section>

      {/* Category Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`shrink-0 h-8 px-3.5 rounded-pill text-xs font-medium transition ${
              selectedCategory === cat
                ? 'bg-surface-2 text-white border border-white/20 font-bold'
                : 'text-text-tertiary hover:text-white'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Menu Grid */}
      <section className="grid grid-cols-2 gap-2.5 mb-6">
        {filteredProducts.map((p) => (
          <div
            key={p.id}
            className="glass rounded-md p-3 flex flex-col justify-between min-h-[110px] shadow-sm hover:border-white/20 transition"
          >
            <div>
              <div className="text-xs font-bold text-text-primary leading-tight">{p.name}</div>
              {p.description && (
                <div className="text-[10px] text-text-tertiary mt-1 line-clamp-2">{p.description}</div>
              )}
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
              <span className="text-xs font-mono font-bold text-amber">${p.price.toLocaleString()}</span>
              <button
                onClick={() => addToCart(p)}
                className="w-7 h-7 rounded-full bg-amber text-black hover:bg-amber-hover flex items-center justify-center font-bold text-xs shadow-sm transition active:scale-95"
                title="Agregar al carro"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* Review & Experience Form */}
      <section className="glass rounded-lg p-4 shadow-card mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Star className="w-4 h-4 text-amber" />
          <h2 className="text-xs font-bold uppercase tracking-wider">Califica tu Experiencia</h2>
        </div>

        {reviewMsg && (
          <div
            className={`p-3 rounded-md mb-4 text-xs font-medium flex items-center gap-2 ${
              reviewMsg.type === 'success'
                ? 'bg-emerald/15 border border-emerald/30 text-emerald'
                : 'bg-crimson/15 border border-crimson/30 text-crimson'
            }`}
          >
            {reviewMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{reviewMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmitReview} className="space-y-3">
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className={`flex-1 h-8 rounded-xs flex items-center justify-center gap-1 text-xs font-bold transition ${
                  rating >= star
                    ? 'bg-amber text-black shadow-glowAmber'
                    : 'bg-surface-2 text-text-tertiary hover:bg-white/10'
                }`}
              >
                <Star className="w-3 h-3 fill-current" />
                <span>{star}</span>
              </button>
            ))}
          </div>

          <textarea
            className="w-full rounded-md bg-surface-2 border border-white/10 p-2.5 text-xs text-text-primary focus:outline-none focus:border-amber transition"
            rows={2}
            placeholder="¿Qué te pareció la comida y la atención?"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />

          <button
            type="submit"
            className="w-full h-9 rounded-pill bg-emerald text-white hover:bg-emerald-muted font-bold text-xs flex items-center justify-center gap-1.5 shadow-glowEmerald transition"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Enviar Opinión</span>
          </button>
        </form>
      </section>

      {/* Floating Pre-Order Cart */}
      {cart.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 max-w-[468px] mx-auto glass-strong border border-amber/40 rounded-xl p-3.5 shadow-2xl z-30 animate-slide-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-amber" />
              <span className="text-xs font-bold text-white">Carro de Pre-Orden ({cart.length})</span>
            </div>
            <span className="text-xs font-mono font-bold text-amber">${cartTotal.toLocaleString()}</span>
          </div>

          <div className="max-h-24 overflow-y-auto space-y-1.5 mb-3 pr-1 text-xs">
            {cart.map((item) => (
              <div key={item.product.id} className="flex items-center justify-between bg-surface-2 p-1.5 rounded">
                <span className="truncate max-w-[200px]">{item.product.name}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateCartQty(item.product.id, -1)}
                    className="w-5 h-5 rounded bg-white/10 flex items-center justify-center font-bold"
                  >
                    -
                  </button>
                  <span className="font-mono">{item.quantity}</span>
                  <button
                    onClick={() => updateCartQty(item.product.id, 1)}
                    className="w-5 h-5 rounded bg-white/10 flex items-center justify-center font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleGeneratePreOrder}
            className="w-full h-10 rounded-pill bg-amber text-black hover:bg-amber-hover font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-glowAmber transition active:scale-95"
          >
            <span>Generar Pre-Orden ({channel === 'SALON' ? '#P-12' : (channel === 'TAKEAWAY' ? '#L-45' : '#D-45')})</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
