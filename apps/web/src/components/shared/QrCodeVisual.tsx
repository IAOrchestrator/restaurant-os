import React from 'react';

interface QrCodeVisualProps {
  value: string;
  size?: number;
  className?: string;
  subLabel?: string;
}

// Deterministic 2D Matrix Generator based on hash of string for crisp pixel-perfect SVG QR look
function generateQrMatrix(text: string, moduleCount = 25): boolean[][] {
  const matrix: boolean[][] = Array.from({ length: moduleCount }, () =>
    Array(moduleCount).fill(false),
  );

  // Position detection patterns (corners)
  const drawCorner = (rowStart: number, colStart: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (
          r === 0 ||
          r === 6 ||
          c === 0 ||
          c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          matrix[rowStart + r][colStart + c] = true;
        }
      }
    }
  };

  drawCorner(0, 0); // Top-left
  drawCorner(0, moduleCount - 7); // Top-right
  drawCorner(moduleCount - 7, 0); // Bottom-left

  // Timing patterns
  for (let i = 8; i < moduleCount - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Generate pseudo-random data bits from text hash
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }

  let seed = Math.abs(hash) || 123456789;
  const lcg = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      // Don't overwrite corner patterns
      if (
        (r < 8 && c < 8) ||
        (r < 8 && c >= moduleCount - 8) ||
        (r >= moduleCount - 8 && c < 8) ||
        r === 6 ||
        c === 6
      ) {
        continue;
      }
      matrix[r][c] = lcg() > 0.45;
    }
  }

  return matrix;
}

export function QrCodeVisual({ value, size = 200, className = '', subLabel }: QrCodeVisualProps) {
  const moduleCount = 25;
  const matrix = React.useMemo(() => generateQrMatrix(value, moduleCount), [value]);
  const cellSize = size / moduleCount;

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div
        className="bg-white p-3.5 rounded-2xl shadow-2xl border-4 border-amber relative group overflow-hidden"
        style={{ width: size + 28, height: size + 28 }}
      >
        {/* Animated laser line scanner effect on hover */}
        <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-laser pointer-events-none z-10" />

        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="w-full h-full block"
          shapeRendering="crispEdges"
        >
          {matrix.map((row, r) =>
            row.map((filled, c) =>
              filled ? (
                <rect
                  key={`${r}-${c}`}
                  x={c * cellSize}
                  y={r * cellSize}
                  width={cellSize + 0.1}
                  height={cellSize + 0.1}
                  fill="#000000"
                />
              ) : null,
            ),
          )}
        </svg>
      </div>

      {subLabel && (
        <div className="mt-2.5 text-[11px] font-mono text-text-tertiary text-center font-bold">
          {subLabel}
        </div>
      )}
    </div>
  );
}
