import * as React from 'react';
import { createPortal } from 'react-dom';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener?.('change', sync);
    return () => mq.removeEventListener?.('change', sync);
  }, []);

  return reduced;
}

type AnchorSide = 'bottom' | 'top';
type AnchorAlign = 'start' | 'end' | 'center';

export function useAnchoredPortal(
  open: boolean,
  opts: { side?: AnchorSide; align?: AnchorAlign; gap?: number } = {},
) {
  const { side = 'bottom', align = 'end', gap = 4 } = opts;
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const panelRef = React.useRef<HTMLElement | null>(null);
  const [anchored, setAnchored] = React.useState(false);
  const [panelStyle, setPanelStyle] = React.useState<React.CSSProperties>({});

  React.useLayoutEffect(() => {
    if (!open) {
      setAnchored(false);
      return;
    }

    const update = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const style: React.CSSProperties = {
        position: 'fixed',
        zIndex: 60,
      };

      if (side === 'bottom') style.top = rect.bottom + gap;
      else style.bottom = window.innerHeight - rect.top + gap;

      if (align === 'end') style.right = Math.max(8, window.innerWidth - rect.right);
      else if (align === 'center') style.left = rect.left + rect.width / 2;
      else style.left = rect.left;

      if (align === 'center') style.transform = 'translateX(-50%)';

      setPanelStyle(style);
      setAnchored(true);
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, side, align, gap]);

  const renderInPortal = React.useCallback((node: React.ReactNode) => {
    if (typeof document === 'undefined' || !node) return null;
    return createPortal(node, document.body);
  }, []);

  return { triggerRef, panelRef, panelStyle, anchored, renderInPortal };
}
