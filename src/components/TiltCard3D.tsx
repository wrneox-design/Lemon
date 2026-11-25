import { useRef, useState, type ReactNode } from 'react';

interface TiltCard3DProps {
  children: ReactNode;
  className?: string;
  maxTiltDeg?: number;
}

export function TiltCard3D({
  children,
  className = '',
  maxTiltDeg = 7,
}: TiltCard3DProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, glareX: 50, glareY: 50, active: false });

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const ry = (px - 0.5) * maxTiltDeg * 2;
    const rx = -(py - 0.5) * maxTiltDeg * 2;
    setTilt({
      rx,
      ry,
      glareX: Math.round(px * 100),
      glareY: Math.round(py * 100),
      active: true,
    });
  };

  const handlePointerLeave = () => {
    setTilt({ rx: 0, ry: 0, glareX: 50, glareY: 50, active: false });
  };

  return (
    <div className="perspective-1200">
      <div
        ref={cardRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        style={{
          transform: `rotateX(${tilt.rx.toFixed(2)}deg) rotateY(${tilt.ry.toFixed(
            2
          )}deg) translateZ(${tilt.active ? '8px' : '0px'})`,
          transition: tilt.active
            ? 'transform 120ms cubic-bezier(0.16, 1, 0.3, 1)'
            : 'transform 380ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className={`relative preserve-3d will-change-transform ${className}`}
      >
        {children}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-200"
          style={{
            opacity: tilt.active ? 0.45 : 0,
            background: `radial-gradient(circle at ${tilt.glareX}% ${tilt.glareY}%, rgba(254, 240, 138, 0.35), transparent 62%)`,
          }}
        />
      </div>
    </div>
  );
}
