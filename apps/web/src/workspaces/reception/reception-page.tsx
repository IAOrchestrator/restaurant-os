import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import { useAppContext, DEFAULT_WAITER_ID } from '../../hooks/useContextState';
import { useSse } from '../../hooks/useSse';
import {
  Users,
  UserPlus,
  RefreshCw,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  MapPin,
  ChevronRight,
  LogOut,
} from 'lucide-react';

export interface TableItem {
  id: string;
  restaurantId: string;
  number: number;
  capacity: number;
  status: 'AVAILABLE' | 'ASSIGNED' | 'OCCUPIED';
}

export interface StaffItem {
  id: string;
  name: string;
  roles: string[];
}

export interface TableSessionItem {
  id: string;
  tableId: string;
  status: string;
  currentWaiterId: string;
}

export interface WaitlistEntry {
  id: string;
  customerId: string;
  partySize: number;
  status: 'WAITING' | 'CALLED' | 'CONFIRMED' | 'SEATED' | 'CANCELLED';
  enteredAt?: string;
  customerName?: string;
}

export function ReceptionPage() {
  const { restaurantId, authToken } = useAppContext();
  const { request } = useApi();
  const [tables, setTables] = useState<TableItem[]>([]);
  const [sessions, setSessions] = useState<TableSessionItem[]>([]);
  const [waiters, setWaiters] = useState<StaffItem[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Selected waiter for opening tables
  const [selectedWaiterId, setSelectedWaiterId] = useState<string>(DEFAULT_WAITER_ID);

  // New waitlist modal / form state
  const [customerName, setCustomerName] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [phone, setPhone] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [tablesRes, sessionsRes, staffRes, waitlistRes] = await Promise.all([
      request<TableItem[]>(`/api/tables?restaurantId=${restaurantId}`),
      request<TableSessionItem[]>(`/api/table-sessions?restaurantId=${restaurantId}`),
      request<StaffItem[]>(`/api/staff?restaurantId=${restaurantId}&role=WAITER`),
      request<WaitlistEntry[]>(`/api/waitlist?restaurantId=${restaurantId}`),
    ]);

    if (tablesRes.data) setTables(tablesRes.data);
    if (sessionsRes.data) setSessions(sessionsRes.data.filter((s) => s.status !== 'CLOSED'));
    if (staffRes.data) {
      setWaiters(staffRes.data);
      if (!selectedWaiterId && staffRes.data.length > 0) {
        setSelectedWaiterId(staffRes.data[0].id);
      }
    }
    if (waitlistRes.data) setWaitlist(waitlistRes.data);
    setLoading(false);
  }, [request, restaurantId, selectedWaiterId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Real-time updates
  useSse({
    token: authToken,
    eventTypes: ['TABLE_ASSIGNED', 'TABLE_RELEASED', 'TABLE_CLOSED', 'WAITLIST_JOINED', 'WAITLIST_SEATED'],
    onEvent: () => {
      fetchData();
    },
  });

  const waiterMap = waiters.reduce<Record<string, string>>((acc, w) => {
    acc[w.id] = w.name;
    return acc;
  }, {});

  const sessionByTableId = sessions.reduce<Record<string, TableSessionItem>>((acc, s) => {
    acc[s.tableId] = s;
    return acc;
  }, {});

  // Join Waitlist
  const handleJoinWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) return;

    setErrorMsg(null);
    const customerId = crypto.randomUUID();
    await request('/api/customers', {
      method: 'POST',
      body: JSON.stringify({
        id: customerId,
        name: customerName.trim(),
        phone: phone.trim() || undefined,
      }),
    });

    const res = await request('/api/waitlist/join', {
      method: 'POST',
      body: JSON.stringify({
        restaurantId,
        customerId,
        partySize: Number(partySize),
      }),
    });

    if (res.data) {
      setCustomerName('');
      setPhone('');
      setPartySize(2);
      setShowAddModal(false);
      fetchData();
    } else {
      setErrorMsg(res.error || 'Error al agregar a la lista de espera');
    }
  };

  // Open Table Session (Occupy table)
  const handleOpenTable = async (tableId: string) => {
    setErrorMsg(null);
    const res = await request('/api/table-sessions', {
      method: 'POST',
      body: JSON.stringify({
        restaurantId,
        tableId,
        initialWaiterId: selectedWaiterId,
      }),
    });

    if (res.data) {
      fetchData();
    } else {
      setErrorMsg(res.error || 'Error al abrir mesa');
    }
  };

  // Close Table Session
  const handleCloseSession = async (sessionId: string) => {
    setErrorMsg(null);
    const res = await request(`/api/table-sessions/${sessionId}/close`, {
      method: 'POST',
    });
    if (res.data) {
      fetchData();
    } else {
      setErrorMsg(res.error || 'Error al cerrar sesión de mesa');
    }
  };

  // Seat customer from waitlist
  const handleSeatCustomer = async (waitlistEntryId: string, tableId: string) => {
    setErrorMsg(null);
    // 1. Open table session
    const sessionRes = await request<{ id: string }>('/api/table-sessions', {
      method: 'POST',
      body: JSON.stringify({
        restaurantId,
        tableId,
        initialWaiterId: selectedWaiterId,
      }),
    });

    if (sessionRes.data) {
      // 2. Seat on waitlist
      await request(`/api/waitlist/${waitlistEntryId}/seat`, {
        method: 'POST',
      });
      fetchData();
    } else {
      setErrorMsg(sessionRes.error || 'Error al sentar comensal en mesa');
    }
  };

  const waitingList = waitlist.filter((w) => w.status === 'WAITING' || w.status === 'CALLED');

  return (
    <div className="min-h-screen bg-background text-text-primary p-4 lg:p-6">
      {/* Header */}
      <header className="glass sticky top-0 z-20 rounded-lg px-5 h-[64px] flex items-center justify-between mb-6 shadow-card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-sm bg-amber text-black flex items-center justify-center font-bold shadow-glowAmber">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">Recepción & Salón</h1>
            <p className="text-xs text-text-tertiary">Plano del restaurante y lista de espera en vivo</p>
          </div>
        </div>

        {/* Waiter Assign Selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-surface-2 border border-white/5 rounded-pill px-3 py-1.5 text-xs">
            <span className="text-text-tertiary font-medium">Mozo asignado:</span>
            <select
              value={selectedWaiterId}
              onChange={(e) => setSelectedWaiterId(e.target.value)}
              className="bg-transparent font-bold text-amber focus:outline-none cursor-pointer"
            >
              {waiters.map((w) => (
                <option key={w.id} value={w.id} className="bg-surface-2 text-text-primary">
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="h-9 px-3 rounded-pill glass hover:bg-white/10 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
            title="Refrescar"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refrescar</span>
          </button>
        </div>
      </header>

      {errorMsg && (
        <div className="mb-6 p-4 rounded-md bg-crimson/15 border border-crimson/30 text-crimson flex items-center gap-3 animate-slide-in">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">{errorMsg}</span>
        </div>
      )}

      {/* Main Grid: Left 70% Floor Map, Right 30% Waitlist */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Floor Map Section */}
        <section className="lg:col-span-8 rounded-lg bg-surface-1 border border-white/5 p-5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-white/5">
            <div>
              <h2 className="text-sm font-bold tracking-tight">Plano del Salón Principal</h2>
              <p className="text-xs text-text-tertiary">Haz clic en una mesa libre para abrir sesión o en una ocupada para liberarla</p>
            </div>

            {/* Semantic State Legend */}
            <div className="flex items-center gap-3 text-xs font-mono text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full border border-dashed border-white/30" />
                <span className="text-text-secondary">Libre</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-surface-2 border border-amber/40" />
                <span className="text-amber">Ocupada</span>
              </span>
            </div>
          </div>

          {/* Tables Interactive Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {tables.map((table) => {
              const session = sessionByTableId[table.id];
              const isOccupied = table.status === 'OCCUPIED' || !!session;
              const isRound = table.capacity <= 4;
              const assignedWaiterName = session ? waiterMap[session.currentWaiterId] || 'Mozo' : null;

              return (
                <div
                  key={table.id}
                  className={`p-4 transition-all duration-200 flex flex-col items-center justify-between min-h-[130px] shadow-sm relative group ${
                    isRound ? 'rounded-2xl' : 'rounded-md'
                  } ${
                    isOccupied
                      ? 'bg-surface-2 border-2 border-amber/40 shadow-glowAmber'
                      : 'bg-white/[0.02] border-2 border-dashed border-white/15 hover:border-white/40 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-mono font-bold text-text-tertiary">{table.capacity}p</span>
                    <span className={`w-2 h-2 rounded-full ${isOccupied ? 'bg-amber animate-pulse' : 'bg-white/20'}`} />
                  </div>

                  <div className="text-center my-2">
                    <div className="text-base font-extrabold tracking-tight">Mesa {table.number}</div>
                    {isOccupied && (
                      <div className="text-[11px] text-amber font-medium truncate max-w-[100px]">
                        {assignedWaiterName}
                      </div>
                    )}
                  </div>

                  {/* Quick Action Button */}
                  {isOccupied ? (
                    <button
                      onClick={() => session && handleCloseSession(session.id)}
                      className="w-full h-7 rounded-xs glass text-[10px] font-bold text-text-secondary hover:text-crimson hover:bg-crimson/20 transition flex items-center justify-center gap-1"
                    >
                      <LogOut className="w-3 h-3" />
                      <span>Liberar</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleOpenTable(table.id)}
                      className="w-full h-7 rounded-xs bg-amber text-black hover:bg-amber-hover font-bold text-[10px] transition shadow-sm"
                    >
                      Ocupar Mesa
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Waitlist Section */}
        <section className="lg:col-span-4 rounded-lg bg-surface-1 border border-white/5 p-5 shadow-card flex flex-col">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-amber" />
              <h2 className="text-sm font-bold">Lista de Espera</h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded-pill bg-surface-2 text-amber font-bold">
                {waitingList.length}
              </span>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="h-8 px-3 rounded-pill bg-amber text-black hover:bg-amber-hover text-xs font-bold flex items-center gap-1 shadow-glowAmber transition active:scale-95"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Añadir</span>
            </button>
          </div>

          {/* Add Customer Modal */}
          {showAddModal && (
            <form onSubmit={handleJoinWaitlist} className="glass-strong border border-amber/30 rounded-md p-4 mb-4 space-y-3 animate-slide-in">
              <div className="text-xs font-bold uppercase tracking-wider text-amber">Nuevo en Espera</div>
              <input
                type="text"
                placeholder="Nombre del comensal"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
                className="w-full h-9 rounded-xs bg-surface-2 border border-white/10 px-3 text-xs focus:outline-none focus:border-amber"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min="1"
                  max="20"
                  placeholder="Pax"
                  value={partySize}
                  onChange={(e) => setPartySize(Number(e.target.value))}
                  className="h-9 rounded-xs bg-surface-2 border border-white/10 px-3 text-xs focus:outline-none focus:border-amber"
                />
                <input
                  type="tel"
                  placeholder="Teléfono (opcional)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-9 rounded-xs bg-surface-2 border border-white/10 px-3 text-xs focus:outline-none focus:border-amber"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" className="flex-1 h-8 rounded-pill bg-amber text-black font-bold text-xs">
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="h-8 px-3 rounded-pill glass text-xs text-text-secondary"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* Waitlist Entries */}
          <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px] pr-1">
            {waitingList.length === 0 ? (
              <div className="h-40 border border-dashed border-white/10 rounded-md flex flex-col items-center justify-center text-text-tertiary gap-2">
                <Users className="w-6 h-6 opacity-30" />
                <span className="text-xs">No hay comensales en espera</span>
              </div>
            ) : (
              waitingList.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-md bg-surface-2 border border-white/5 p-3.5 flex flex-col gap-2.5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-text-primary">{entry.customerName || 'Comensal'}</div>
                      <div className="text-xs text-text-secondary font-mono">
                        {entry.partySize} personas • {entry.enteredAt ? new Date(entry.enteredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Ahora'}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-pill bg-amber/15 text-amber text-[10px] font-bold font-mono">
                      {entry.status}
                    </span>
                  </div>

                  {/* Seat in Available Table dropdown */}
                  <div className="pt-2 border-t border-white/5 flex items-center gap-2">
                    <span className="text-[11px] text-text-tertiary">Sentar en:</span>
                    <div className="flex-1 flex gap-1.5 overflow-x-auto scrollbar-none">
                      {tables
                        .filter((t) => t.status === 'AVAILABLE' && !sessionByTableId[t.id])
                        .map((availTable) => (
                          <button
                            key={availTable.id}
                            onClick={() => handleSeatCustomer(entry.id, availTable.id)}
                            className="shrink-0 h-7 px-2.5 rounded-xs bg-emerald text-white hover:bg-emerald-muted font-bold text-[10px] flex items-center gap-1 shadow-sm"
                          >
                            <span>Mesa {availTable.number}</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
