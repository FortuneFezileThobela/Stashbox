import React, { useEffect, useState } from "react";
import { subscribeToast, type ToastMessage } from "../lib/toast";

// Shows one toast at a time.
export const ToastHost: React.FC = () => {
  const [current, setCurrent] = useState<ToastMessage | null>(null);

  useEffect(() => subscribeToast(setCurrent), []);

  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(() => setCurrent(null), current.kind === "error" ? 6500 : 3500);
    return () => clearTimeout(timer);
  }, [current]);

  if (!current) return null;

  return (
    <div className="toast-host" role={current.kind === "error" ? "alert" : "status"}>
      <div key={current.id} className={`toast-card toast-${current.kind}`}>
        <span>{current.text}</span>
        <button type="button" aria-label="Dismiss message" onClick={() => setCurrent(null)}>
          Dismiss
        </button>
      </div>
    </div>
  );
};