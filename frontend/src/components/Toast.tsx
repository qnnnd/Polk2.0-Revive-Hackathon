"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface ToastCtx {
  show: (message: string) => void;
}

const noop = (): void => { /* default */ };
const Ctx = createContext<ToastCtx>({ show: noop });
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState("");
  const [visible, setVisible] = useState(false);

  const show = useCallback((m: string) => {
    setMsg(m);
    setVisible(true);
    setTimeout(() => setVisible(false), 2500);
  }, []);

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      {visible && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-2xl border border-line bg-card/95 px-4 py-3 text-sm text-white shadow-2xl backdrop-blur">
          {msg}
        </div>
      )}
    </Ctx.Provider>
  );
}
