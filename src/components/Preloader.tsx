const Preloader = ({ message }: { message?: string }) => {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="flex flex-col items-center gap-5">
        {/* Subtle pulsing dot */}
        <div className="relative h-2 w-2">
          <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-75" />
          <span className="relative block h-2 w-2 rounded-full bg-primary" />
        </div>

        {/* Thin progress bar */}
        <div className="h-px w-32 overflow-hidden bg-foreground/10">
          <div className="h-full w-1/3 bg-primary/80 animate-[slide_1.2s_ease-in-out_infinite]" 
               style={{ animationName: 'preloader-slide' }} />
        </div>

        {message && (
          <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-muted-foreground/70">
            {message}
          </p>
        )}
      </div>

      <style>{`
        @keyframes preloader-slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
};

export default Preloader;
