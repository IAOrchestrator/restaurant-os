import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import { useAppContext, DEFAULT_CUSTOMER_ID } from '../../hooks/useContextState';
import { useSse } from '../../hooks/useSse';
import {
  Sparkles,
  Star,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Flame,
  ChefHat,
  Send,
  MessageSquare,
} from 'lucide-react';

export interface CatalogProduct {
  id: string;
  name: string;
  price: number;
  description?: string;
  available: boolean;
}

export function CustomerPage() {
  const { restaurantId, actorId, authToken } = useAppContext();
  const { request } = useApi();

  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewMsg, setReviewMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchMenu = useCallback(async () => {
    const res = await request<CatalogProduct[]>(`/api/catalog/products?restaurantId=${restaurantId}`);
    if (res.data) setProducts(res.data.filter((p) => p.available));
  }, [request, restaurantId]);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  // Real-time SSE
  useSse({
    token: authToken,
    eventTypes: ['ORDER_SENT_TO_KITCHEN', 'ORDER_READY', 'ORDER_DELIVERED'],
    onEvent: () => {
      // live updates
    },
  });

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewMsg(null);

    const res = await request('/api/reviews', {
      method: 'POST',
      body: JSON.stringify({
        restaurantId,
        customerId: actorId || DEFAULT_CUSTOMER_ID,
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

  return (
    <div className="min-h-screen bg-background text-text-primary p-4 max-w-[480px] mx-auto pb-16">
      {/* Header Bar */}
      <header className="glass rounded-lg p-4 mb-5 shadow-card flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-sm bg-emerald text-white flex items-center justify-center font-bold shadow-glowEmerald">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-text-tertiary font-bold">Portal del Comensal</div>
            <div className="text-sm font-bold">Tu Experiencia en Vivo</div>
          </div>
        </div>
        <div className="text-[11px] font-mono text-emerald bg-emerald/10 border border-emerald/20 px-2.5 py-1 rounded-pill flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse" />
          <span>Conectado</span>
        </div>
      </header>

      {/* Live Order Timeline */}
      <section className="glass rounded-lg p-4 mb-5 shadow-card">
        <div className="text-xs uppercase tracking-wider font-bold text-amber mb-3 flex items-center gap-1.5">
          <Flame className="w-3.5 h-3.5" />
          <span>Estado del Pedido</span>
        </div>

        <div className="relative pl-6 space-y-4 border-l border-white/10 my-2">
          <div className="relative">
            <span className="absolute -left-[31px] top-0.5 w-3.5 h-3.5 rounded-full bg-emerald border-2 border-background flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
            </span>
            <div className="text-xs font-bold text-text-primary">1. Pedido Solicitado</div>
            <div className="text-[11px] text-text-tertiary font-mono">Registrado en el sistema</div>
          </div>

          <div className="relative">
            <span className="absolute -left-[31px] top-0.5 w-3.5 h-3.5 rounded-full bg-amber border-2 border-background animate-pulse" />
            <div className="text-xs font-bold text-amber">2. En Cocina / Marchando</div>
            <div className="text-[11px] text-text-tertiary font-mono">Los chefs están preparando tus platos</div>
          </div>

          <div className="relative">
            <span className="absolute -left-[31px] top-0.5 w-3.5 h-3.5 rounded-full bg-surface-2 border-2 border-white/20" />
            <div className="text-xs font-semibold text-text-secondary">3. Listo para Servir</div>
            <div className="text-[11px] text-text-tertiary font-mono">En camino a tu mesa</div>
          </div>

          <div className="relative">
            <span className="absolute -left-[31px] top-0.5 w-3.5 h-3.5 rounded-full bg-surface-2 border-2 border-white/20" />
            <div className="text-xs font-semibold text-text-secondary">4. Entregado</div>
            <div className="text-[11px] text-text-tertiary font-mono">¡Buen provecho!</div>
          </div>
        </div>
      </section>

      {/* Review & Experience Form */}
      <section className="glass rounded-lg p-4 mb-5 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          <Star className="w-4 h-4 text-amber" />
          <h2 className="text-sm font-bold">Califica tu Experiencia</h2>
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

        <form onSubmit={handleSubmitReview} className="space-y-4">
          <div>
            <label className="text-xs text-text-secondary block mb-2 font-medium">Puntaje:</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`flex-1 h-10 rounded-xs flex items-center justify-center gap-1 text-sm font-bold transition ${
                    rating >= star
                      ? 'bg-amber text-black shadow-glowAmber'
                      : 'bg-surface-2 text-text-tertiary hover:bg-white/10'
                  }`}
                >
                  <Star className="w-4 h-4 fill-current" />
                  <span>{star}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-text-secondary block mb-2 font-medium">Comentarios o sugerencias:</label>
            <textarea
              className="w-full rounded-md bg-surface-2 border border-white/10 p-3 text-xs text-text-primary focus:outline-none focus:border-amber transition"
              rows={3}
              placeholder="¿Qué te pareció la comida, la velocidad y la atención?"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="w-full h-11 rounded-sm bg-emerald text-white hover:bg-emerald-muted font-bold text-xs flex items-center justify-center gap-2 shadow-glowEmerald transition active:scale-98"
          >
            <Send className="w-4 h-4" />
            <span>Enviar Calificación</span>
          </button>
        </form>
      </section>

      {/* Menu Preview */}
      <section className="glass rounded-lg p-4 shadow-card">
        <div className="text-xs uppercase tracking-wider font-bold text-text-tertiary mb-3">
          Carta Digital del Restaurante
        </div>
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {products.map((p) => (
            <div key={p.id} className="rounded-xs bg-surface-1 border border-white/5 p-3 flex justify-between items-center">
              <div>
                <div className="text-xs font-semibold text-text-primary">{p.name}</div>
                {p.description && <div className="text-[11px] text-text-tertiary line-clamp-1 mt-0.5">{p.description}</div>}
              </div>
              <span className="text-mono text-xs font-bold text-amber">${p.price.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
