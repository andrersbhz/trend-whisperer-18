import { useEffect, useState } from 'react';

interface PreloaderProps {
  message?: string;
  /** 0–100. If omitted, an indeterminate auto-advancing progress is shown. */
  progress?: number;
}

const Preloader = ({ message, progress }: PreloaderProps) => {
  const [autoProgress, setAutoProgress] = useState(0);
  const isControlled = typeof progress === 'number';

  useEffect(() => {
    if (isControlled) return;
    let raf = 0;
    let start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      // Ease toward 98% over ~2s, reaching it quickly to show progress, but never 100% until unmounted.
      const target = Math.min(98, 98 * (1 - Math.exp(-elapsed / 500)));
      setAutoProgress(target);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isControlled]);

  const value = Math.round(isControlled ? Math.max(0, Math.min(100, progress!)) : autoProgress);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="flex flex-col items-center gap-4">
        {/* Subtle pulsing dot */}
        <div className="relative h-2 w-2">
          <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-75" />
          <span className="relative block h-2 w-2 rounded-full bg-primary" />
        </div>

        {/* Determinate progress bar */}
        <div className="h-[3px] w-44 overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full bg-primary transition-[width] duration-300 ease-out"
            style={{ width: `${value}%` }}
          />
        </div>

        {/* Percentage */}
        <div className="flex items-baseline gap-2 tabular-nums">
          <span className="text-2xl font-light text-foreground/90">{value}</span>
          <span className="text-xs text-foreground/50">%</span>
        </div>

        {message && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-foreground/60">
              {message}
            </p>
            <button 
              onClick={() => {
                // Force dispatch a custom event to tell App.tsx or useAuth to stop loading
                console.log('[Preloader] User requested to skip waiting');
                window.dispatchEvent(new CustomEvent('auth-skip-wait'));
              }}
              className="text-[9px] text-primary/70 hover:text-primary underline uppercase tracking-widest mt-2 transition-colors"
            >
              Entrar agora (concluir em 2º plano)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Preloader;
