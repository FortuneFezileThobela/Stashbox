export type ToastKind = "success" | "error" | "info";

export interface ToastMessage {
  id: number;
  kind: ToastKind;
  text: string;
}

type Listener = (message: ToastMessage | null) => void;

//a single host listens, and a new message replaces the current one.
let listener: Listener | null = null;
let nextId = 1;

const show = (kind: ToastKind, text: string) => {
  listener?.({ id: nextId++, kind, text });
};

export const toast = {
  success: (text: string) => show("success", text),
  error: (text: string) => show("error", text),
  info: (text: string) => show("info", text),
  dismiss: () => listener?.(null),
};

export const subscribeToast = (fn: Listener) => {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
};
