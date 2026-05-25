import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

const Preloader = ({ message = "carregando dados aguarde" }: { message?: string }) => {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background animate-in fade-in duration-500">
      <div className="relative">
        <div className="h-24 w-24 rounded-full border-t-2 border-b-2 border-primary animate-spin shadow-[0_0_15px_hsla(var(--primary)/0.3)]"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-10 w-10 text-primary animate-pulse" />
        </div>
      </div>
      <p className="mt-6 text-sm font-bold uppercase tracking-[0.2em] text-foreground animate-pulse">
        {message}
      </p>
    </div>
  );
};

export default Preloader;
