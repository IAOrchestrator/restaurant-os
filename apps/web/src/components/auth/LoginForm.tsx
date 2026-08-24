import React, { useState } from 'react';
import { useAppContext } from '../../hooks/useContextState';
import {
  Users,
  Tablet,
  QrCode,
  Lock,
  KeyRound,
  Mail,
  Building2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

export function LoginForm() {
  const { loginStaff, loginTableDevice, loginCustomerSession, authError, setAuthError } = useAppContext();

  const [activeTab, setActiveTab] = useState<'STAFF' | 'TABLE_DEVICE' | 'CUSTOMER'>('STAFF');
  const [loading, setLoading] = useState(false);

  // Common
  const [restaurantId, setRestaurantId] = useState('a0000000-0000-0000-0000-000000000001');

  // Staff
  const [staffIdType, setStaffIdType] = useState<'EMAIL' | 'ID'>('EMAIL');
  const [email, setEmail] = useState('');
  const [staffId, setStaffId] = useState('');
  const [credType, setCredType] = useState<'PASSWORD' | 'PIN'>('PASSWORD');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');

  // Table Device
  const [deviceId, setDeviceId] = useState('');
  const [deviceSecret, setDeviceSecret] = useState('');

  // Customer
  const [customerName, setCustomerName] = useState('');
  const [tableSessionId, setTableSessionId] = useState('');

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError(null);

    const res = await loginStaff({
      restaurantId,
      email: staffIdType === 'EMAIL' ? email : undefined,
      staffId: staffIdType === 'ID' ? staffId : undefined,
      password: credType === 'PASSWORD' ? password : undefined,
      pin: credType === 'PIN' ? pin : undefined,
    });

    setLoading(false);
  };

  const handleDeviceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError(null);

    const res = await loginTableDevice({
      restaurantId,
      deviceId,
      deviceSecret,
    });

    setLoading(false);
  };

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError(null);

    const res = await loginCustomerSession({
      restaurantId,
      name: customerName || undefined,
      tableSessionId: tableSessionId || undefined,
    });

    setLoading(false);
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md glass-strong rounded-[24px] border border-white/10 p-6 md:p-8 shadow-card relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header / Brand */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-amber text-black flex items-center justify-center font-black text-xl mx-auto mb-3 shadow-glowAmber">
            R
          </div>
          <h2 className="text-xl font-black tracking-tight text-text-primary">
            Restaurant OS
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            Sistema Operativo y Terminal Unificada
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center bg-surface-1 p-1 rounded-pill border border-white/5 mb-6">
          <button
            type="button"
            className={`flex-1 py-2 rounded-pill text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              activeTab === 'STAFF'
                ? 'bg-amber text-black shadow-glowAmber'
                : 'text-text-secondary hover:text-white'
            }`}
            onClick={() => {
              setActiveTab('STAFF');
              setAuthError(null);
            }}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Personal</span>
          </button>
          <button
            type="button"
            className={`flex-1 py-2 rounded-pill text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              activeTab === 'TABLE_DEVICE'
                ? 'bg-amber text-black shadow-glowAmber'
                : 'text-text-secondary hover:text-white'
            }`}
            onClick={() => {
              setActiveTab('TABLE_DEVICE');
              setAuthError(null);
            }}
          >
            <Tablet className="w-3.5 h-3.5" />
            <span>Tablet</span>
          </button>
          <button
            type="button"
            className={`flex-1 py-2 rounded-pill text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              activeTab === 'CUSTOMER'
                ? 'bg-amber text-black shadow-glowAmber'
                : 'text-text-secondary hover:text-white'
            }`}
            onClick={() => {
              setActiveTab('CUSTOMER');
              setAuthError(null);
            }}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Comensal</span>
          </button>
        </div>

        {/* Error Alert */}
        {authError && (
          <div className="mb-4 p-3 rounded-lg bg-crimson/15 border border-crimson/30 flex items-center gap-2.5 text-crimson text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="break-words">{authError}</span>
          </div>
        )}

        {/* STAFF FORM */}
        {activeTab === 'STAFF' && (
          <form onSubmit={handleStaffSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5">
                Restaurante (UUID)
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={restaurantId}
                  onChange={(e) => setRestaurantId(e.target.value)}
                  className="w-full bg-surface-1 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-text-primary focus:outline-none focus:border-amber transition font-mono"
                  placeholder="ID del restaurante"
                />
              </div>
            </div>

            {/* Staff Identifier Switcher */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider">
                  Identificador
                </label>
                <div className="flex gap-2 text-[10px]">
                  <button
                    type="button"
                    className={`font-semibold cursor-pointer ${
                      staffIdType === 'EMAIL' ? 'text-amber underline' : 'text-text-tertiary'
                    }`}
                    onClick={() => setStaffIdType('EMAIL')}
                  >
                    Email
                  </button>
                  <span className="text-text-tertiary">|</span>
                  <button
                    type="button"
                    className={`font-semibold cursor-pointer ${
                      staffIdType === 'ID' ? 'text-amber underline' : 'text-text-tertiary'
                    }`}
                    onClick={() => setStaffIdType('ID')}
                  >
                    Staff ID
                  </button>
                </div>
              </div>

              {staffIdType === 'EMAIL' ? (
                <div className="relative">
                  <Mail className="w-4 h-4 text-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-surface-1 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-text-primary focus:outline-none focus:border-amber transition"
                    placeholder="mozo@restaurant.com"
                  />
                </div>
              ) : (
                <div className="relative">
                  <Users className="w-4 h-4 text-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value)}
                    className="w-full bg-surface-1 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-text-primary focus:outline-none focus:border-amber transition font-mono"
                    placeholder="UUID del personal"
                  />
                </div>
              )}
            </div>

            {/* Credential Switcher */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider">
                  Credencial
                </label>
                <div className="flex gap-2 text-[10px]">
                  <button
                    type="button"
                    className={`font-semibold cursor-pointer ${
                      credType === 'PASSWORD' ? 'text-amber underline' : 'text-text-tertiary'
                    }`}
                    onClick={() => setCredType('PASSWORD')}
                  >
                    Contraseña
                  </button>
                  <span className="text-text-tertiary">|</span>
                  <button
                    type="button"
                    className={`font-semibold cursor-pointer ${
                      credType === 'PIN' ? 'text-amber underline' : 'text-text-tertiary'
                    }`}
                    onClick={() => setCredType('PIN')}
                  >
                    Código PIN
                  </button>
                </div>
              </div>

              {credType === 'PASSWORD' ? (
                <div className="relative">
                  <Lock className="w-4 h-4 text-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-surface-1 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-text-primary focus:outline-none focus:border-amber transition"
                    placeholder="••••••••••••"
                  />
                </div>
              ) : (
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    required
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="w-full bg-surface-1 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-text-primary focus:outline-none focus:border-amber transition tracking-widest font-mono"
                    placeholder="PIN numérico"
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-amber hover:bg-amber-hover text-black font-bold text-xs flex items-center justify-center gap-2 shadow-glowAmber transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Verificando...' : 'Iniciar Sesión'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* TABLE DEVICE FORM */}
        {activeTab === 'TABLE_DEVICE' && (
          <form onSubmit={handleDeviceSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5">
                Restaurante (UUID)
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={restaurantId}
                  onChange={(e) => setRestaurantId(e.target.value)}
                  className="w-full bg-surface-1 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-text-primary focus:outline-none focus:border-amber transition font-mono"
                  placeholder="ID del restaurante"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5">
                Device ID (Tablet)
              </label>
              <div className="relative">
                <Tablet className="w-4 h-4 text-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  className="w-full bg-surface-1 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-text-primary focus:outline-none focus:border-amber transition font-mono"
                  placeholder="UUID del dispositivo"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5">
                Secreto del Dispositivo
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={deviceSecret}
                  onChange={(e) => setDeviceSecret(e.target.value)}
                  className="w-full bg-surface-1 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-text-primary focus:outline-none focus:border-amber transition"
                  placeholder="Secreto de terminal"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-amber hover:bg-amber-hover text-black font-bold text-xs flex items-center justify-center gap-2 shadow-glowAmber transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Vinculando...' : 'Conectar Terminal'}
              <ShieldCheck className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* CUSTOMER FORM */}
        {activeTab === 'CUSTOMER' && (
          <form onSubmit={handleCustomerSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5">
                Restaurante (UUID)
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={restaurantId}
                  onChange={(e) => setRestaurantId(e.target.value)}
                  className="w-full bg-surface-1 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-text-primary focus:outline-none focus:border-amber transition font-mono"
                  placeholder="ID del restaurante"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5">
                Tu Nombre o Apodo (Opcional)
              </label>
              <div className="relative">
                <Users className="w-4 h-4 text-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-surface-1 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-text-primary focus:outline-none focus:border-amber transition"
                  placeholder="Ej: Laura"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5">
                Sesión de Mesa (Código QR / UUID)
              </label>
              <div className="relative">
                <QrCode className="w-4 h-4 text-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={tableSessionId}
                  onChange={(e) => setTableSessionId(e.target.value)}
                  className="w-full bg-surface-1 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-text-primary focus:outline-none focus:border-amber transition font-mono"
                  placeholder="UUID de la sesión de mesa"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-amber hover:bg-amber-hover text-black font-bold text-xs flex items-center justify-center gap-2 shadow-glowAmber transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Ingresando...' : 'Ingresar a la Carta Digital'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
