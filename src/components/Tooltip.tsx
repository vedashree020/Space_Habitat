import { useState } from 'react';
import type { ReactNode } from 'react';

interface Props {
  text: string;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'right' | 'left';
}

export function Tooltip({ text, children, side = 'right' }: Props) {
  const [show, setShow] = useState(false);

  const pos: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div
          className={`absolute z-50 ${pos[side]} px-2.5 py-1.5 rounded-lg bg-navy-850 border border-cyan-glow/30 text-[11px] text-slate-200 whitespace-nowrap pointer-events-none animate-fade-in shadow-xl shadow-black/40 max-w-[220px] normal-case`}
        >
          {text}
        </div>
      )}
    </div>
  );
}
