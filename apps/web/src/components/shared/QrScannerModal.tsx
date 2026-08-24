import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, CheckCircle2, AlertCircle, Scan, Keyboard, Sparkles } from 'lucide-react';

export interface QrPayload {
  code: string; // e.g. #P-12, #L-45, #D-45
  channel?: 'SALON' | 'TAKEAWAY' | 'DELIVERY';
  customerName?: string;
  itemsCount?: number;
  totalAmount?: number;
}

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (payload: QrPayload) => void;
  title?: string;
  subtitle?: string;
}

export function QrScannerModal({
  isOpen,
  onClose,
  onScanSuccess,
  title = 'Escanear QR de Cliente',
  subtitle = 'Apunta con la cámara al código QR en el celular del cliente',
}: QrScannerModalProps) {
  const [manualCode, setManualCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setCameraActive(false);
      setCameraError(null);
      setManualCode('');
      return;
    }

    // Try starting camera stream
    const startCamera = async () => {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
          });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }
          setCameraActive(true);
        } else {
          setCameraError('Cámara no disponible en este dispositivo. Usa entrada rápida de código.');
        }
      } catch {
        setCameraError('Permiso de cámara no concedido o no disponible. Puedes ingresar el código alfanumérico.');
      }
    };

    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;

    const formattedCode = manualCode.trim().toUpperCase().startsWith('#')
      ? manualCode.trim().toUpperCase()
      : `#${manualCode.trim().toUpperCase()}`;

    const channel = formattedCode.startsWith('#P')
      ? 'SALON'
      : (formattedCode.startsWith('#L') ? 'TAKEAWAY' : 'DELIVERY');

    onScanSuccess({
      code: formattedCode,
      channel,
      customerName: 'Cliente Escaneado',
    });
    onClose();
  };

  const handleQuickDemoCode = (code: string) => {
    const channel = code.startsWith('#P')
      ? 'SALON'
      : (code.startsWith('#L') ? 'TAKEAWAY' : 'DELIVERY');

    onScanSuccess({
      code,
      channel,
      customerName: 'Cliente Escaneado',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-md bg-surface-1 border border-white/10 rounded-2xl p-6 shadow-2xl relative flex flex-col">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full glass flex items-center justify-center text-text-secondary hover:text-white transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber text-black flex items-center justify-center font-bold shadow-glowAmber">
            <Scan className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight text-white">{title}</h2>
            <p className="text-xs text-text-tertiary">{subtitle}</p>
          </div>
        </div>

        {/* Camera Viewfinder Box */}
        <div className="relative aspect-square w-full bg-black rounded-xl overflow-hidden border-2 border-dashed border-amber/40 mb-4 flex items-center justify-center">
          {cameraActive ? (
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
          ) : (
            <div className="p-6 text-center text-text-tertiary flex flex-col items-center gap-2">
              <Camera className="w-12 h-12 opacity-30 text-amber animate-pulse" />
              <span className="text-xs font-medium">{cameraError || 'Iniciando escáner de cámara...'}</span>
            </div>
          )}

          {/* Target Reticle Overlay */}
          <div className="absolute inset-8 border-2 border-amber/70 rounded-xl pointer-events-none flex flex-col justify-between p-2 shadow-glowAmber">
            <div className="flex justify-between">
              <div className="w-4 h-4 border-t-2 border-l-2 border-amber" />
              <div className="w-4 h-4 border-t-2 border-r-2 border-amber" />
            </div>
            {/* Animated Scan Line */}
            <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-amber to-transparent animate-laser" />
            <div className="flex justify-between">
              <div className="w-4 h-4 border-b-2 border-l-2 border-amber" />
              <div className="w-4 h-4 border-b-2 border-r-2 border-amber" />
            </div>
          </div>
        </div>

        {/* Quick Demo Scan Codes */}
        <div className="mb-4">
          <div className="text-[11px] font-mono font-bold text-text-tertiary uppercase mb-2">
            Simulador / Códigos Rápidos de Prueba:
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleQuickDemoCode('#P-12')}
              className="flex-1 h-8 rounded-lg bg-surface-2 hover:bg-amber hover:text-black border border-white/10 text-xs font-mono font-bold text-amber transition active:scale-95"
            >
              #P-12 (Salón)
            </button>
            <button
              onClick={() => handleQuickDemoCode('#L-45')}
              className="flex-1 h-8 rounded-lg bg-surface-2 hover:bg-amber hover:text-black border border-white/10 text-xs font-mono font-bold text-amber transition active:scale-95"
            >
              #L-45 (Retiro)
            </button>
            <button
              onClick={() => handleQuickDemoCode('#D-45')}
              className="flex-1 h-8 rounded-lg bg-surface-2 hover:bg-amber hover:text-black border border-white/10 text-xs font-mono font-bold text-amber transition active:scale-95"
            >
              #D-45 (Delivery)
            </button>
          </div>
        </div>

        {/* Manual Keyboard Input Form */}
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Keyboard className="w-4 h-4 text-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Ej: P-12 o L-45"
              className="w-full h-10 rounded-lg bg-surface-2 border border-white/10 pl-9 pr-3 text-xs font-mono text-white focus:outline-none focus:border-amber uppercase"
            />
          </div>
          <button
            type="submit"
            className="h-10 px-4 rounded-lg bg-amber hover:bg-amber-hover text-black font-bold text-xs shadow-glowAmber transition active:scale-95"
          >
            Confirmar
          </button>
        </form>
      </div>
    </div>
  );
}
