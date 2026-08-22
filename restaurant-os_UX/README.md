# Restaurant OS - Design System Kit
Modern Dark Glassmorphism - Tailwind + shadcn/ui + React TSX

## Contenido
- tailwind.config.js -> tokens HSL, animaciones pulse-warning/danger
- index.css -> variables :root + .glass utilities
- components/
  - KitchenWorkspace.tsx (KDS Kanban con timer dinamico)
  - WaiterWorkspace.tsx (Mobile one-handed)
  - TableWorkspace.tsx (Tablet self-order)
  - ReceptionWorkspace.tsx (Plano salon)
  - CustomerWorkspace.tsx (QR web ligera)
  - CashierWorkspace.tsx (POS + split)
  - AdminWorkspace.tsx (Dashboard + catalogo)

## Uso
1. npm i tailwindcss-animate
2. Reemplaza tu tailwind.config.js e index.css
3. Copia los componentes a src/components/
4. Importa: import { KitchenWorkspace } from "@/components/KitchenWorkspace"

Stack: Plus Jakarta Sans + JetBrains Mono + Tailwind
