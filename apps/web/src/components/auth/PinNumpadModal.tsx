import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../../hooks/useContextState';
import {
  KeyRound,
  Delete,
  RotateCcw,
  AlertCircle,
  X,
  CheckCircle2,
  Lock,
  Zap,
} from 'lucide-react';

export interface PinNumpadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (actor: any) => void;
  title?: string;
  subtitle?: string;
  pinLength?: number;
}

export function PinNumpadModal({
  isOpen,
  onClose,
  onSuccess,
  title = 'Desbloqueo Rápido por PIN',
  subtitle = 'Ingresa tu PIN de 4 dígitos para operar',
  pinLength = 4,
}: PinNumpadModalProps) {
  const { restaurantId, loginStaff } = useAppContext();

  const [pin, setPin] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState<boolean>(false);
  const [successActor, setSuccessActor] = useState<any>(null);

  // Reset state on open/close
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError(null);
      setShake(false);
      setSuccessActor(null);
      setLoading(false);
    }
  }, [isOpen]);

  const submitPin = useCallback(
    async (pinToSubmit: string) => {
      if (loading || pinToSubmit.length < pinLength) return;

      setLoading(true);
      setError(null);

      try {
        const res = await loginStaff({
          restaurantId,
          pin: pinToSubmit,
        });

        if (res.success) {
          setSuccessActor(true);
          setTimeout(() => {
            onSuccess?.(res);
            onClose();
          }, 600);
        } else {
          setError(res.error || 'PIN incorrecto o no autorizado');
          setShake(true);
          setTimeout(() => {
            setShake(false);
            setPin('');
          }, 700);
        }
      } catch (err: any) {
        setError(err.message || 'Error de conexión');
        setShake(true);
        setTimeout(() => {
          setShake(false);
          setPin('');
        }, 700);
      } finally {
        setLoading(false);
      }
    },
    [loading, pinLength, loginStaff, restaurantId, onSuccess, onClose],
  );

  const handleDigit = (digit: string) => {
    if (loading || successActor || pin.length >= pinLength) return;
    setError(null);

    const newPin = pin + digit;
    setPin(newPin);

    // Auto submit on reaching required length
    if (newPin.length === pinLength) {
      submitPin(newPin);
    }
  };

  const handleDelete = () => {
    if (loading || successActor || pin.length === 0) return;
    setError(null);
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (loading || successActor) return;
    setError(null);
    setPin('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className={`w-full max-w-sm glass-strong rounded-[28px] border border-white/10 p-6 shadow-2xl relative overflow-hidden flex flex-col items-center select-none ${
          shake ? 'animate-shake border-crimson/50' : ''
        }`}
        style={{ touchAction: 'manipulation' }}
      >
        {/* Background decorative glow */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-amber/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-emerald/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 w-9 h-9 rounded-full glass flex items-center justify-center text-text-tertiary hover:text-white transition active:scale-95 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Icon */}
        <div className="w-14 h-14 rounded-2xl bg-amber/20 border border-amber/40 text-amber flex items-center justify-center font-black mb-3 shadow-glowAmber">
          {successActor ? (
            <CheckCircle2 className="w-7 h-7 text-emerald animate-bounce" />
          ) : (
            <Zap className="w-7 h-7 animate-pulse" />
          )}
        </div>

        <h3 className="text-lg font-black tracking-tight text-white text-center">
          {title}
        </h3>
        <p className="text-xs text-text-tertiary text-center mt-0.5 mb-5">
          {subtitle}
        </p>

        {/* Error Alert */}
        {error && (
          <div className="w-full mb-4 p-2.5 rounded-xl bg-crimson/15 border border-crimson/30 flex items-center justify-center gap-2 text-crimson text-xs font-bold animate-slide-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Banner */}
        {successActor && (
          <div className="w-full mb-4 p-2.5 rounded-xl bg-emerald/15 border border-emerald/30 flex items-center justify-center gap-2 text-emerald text-xs font-bold animate-slide-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>¡Operador verificado con éxito!</span>
          </div>
        )}

        {/* PIN Dot Indicators */}
        <div className="flex items-center gap-4 my-3">
          {Array.from({ length: pinLength }).map((_, idx) => {
            const isFilled = idx < pin.length;
            return (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  isFilled
                    ? 'bg-amber scale-125 shadow-glowAmber'
                    : 'bg-white/10 border border-white/20'
                }`}
              />
            );
          })}
        </div>

        {/* Keypad Grid (0-9, Clear, Backspace) */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[280px] mt-4 mb-2">
          {[
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
            ['C', '0', '⌫'],
          ].map((row, rowIdx) =>
            row.map((val) => {
              if (val === 'C') {
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={handleClear}
                    disabled={loading || pin.length === 0}
                    className="h-14 rounded-2xl glass text-xs font-extrabold text-text-tertiary hover:text-white active:scale-95 transition flex items-center justify-center border border-white/5 cursor-pointer disabled:opacity-30"
                    style={{ touchAction: 'manipulation' }}
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                );
              }
              if (val === '⌫') {
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={handleDelete}
                    disabled={loading || pin.length === 0}
                    className="h-14 rounded-2xl glass text-xs font-extrabold text-text-tertiary hover:text-white active:scale-95 transition flex items-center justify-center border border-white/5 cursor-pointer disabled:opacity-30"
                    style={{ touchAction: 'manipulation' }}
                  >
                    <Delete className="w-5 h-5" />
                  </button>
                );
              }
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleDigit(val)}
                  disabled={loading || successActor}
                  className="h-14 rounded-2xl bg-surface-2/90 hover:bg-white/10 active:bg-amber active:text-black active:scale-95 text-xl font-bold font-mono text-white transition flex items-center justify-center border border-white/10 shadow-sm cursor-pointer"
                  style={{ touchAction: 'manipulation' }}
                >
                  {val}
                </button>
              );
            }),
          )}
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-center gap-2 mt-3 text-xs font-mono text-amber">
            <span className="w-3.5 h-3.5 border-2 border-amber border-t-transparent rounded-full animate-spin" />
            <span>Verificando PIN con Argon2...</span>
          </div>
        )}

        <div className="mt-4 text-[10px] text-text-tertiary font-mono text-center">
          Autenticación segura para tablets de salón & caja
        </div>
      </div>
    </div>
  );
}
