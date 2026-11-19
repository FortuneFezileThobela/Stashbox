declare module "*.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module "*.svg";
declare module "*.png";

interface Storage {
  readonly length: number;
  clear(): void;
  getItem(key: string): string | null;
  key(index: number): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

interface HTMLInputElement {
  value: string;
  checked: boolean;
  disabled: boolean;
  focus(): void;
  select(): void;
}

interface HTMLTextAreaElement {
  value: string;
  disabled: boolean;
  focus(): void;
  select(): void;
}

interface HTMLSelectElement {
  value: string;
  disabled: boolean;
}

interface HTMLButtonElement {
  disabled: boolean;
  type: "submit" | "reset" | "button";
}

declare var console: {
  log(...data: any[]): void;
  error(...data: any[]): void;
  warn(...data: any[]): void;
  info(...data: any[]): void;
};

interface Element {
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
}

interface HTMLElement extends Element {
  style: Record<string, string | number>;
  focus(): void;
}

interface Document {
  documentElement: HTMLElement;
  title: string;
  getElementById(elementId: string): HTMLElement | null;
}

interface Crypto {
  randomUUID(): string;
}

interface Navigator {
  clipboard: {
    writeText(text: string): Promise<void>;
  };
}

interface Navigator {
  platform: string;
}

interface KeyboardEvent {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  preventDefault(): void;
}


interface Window {
  addEventListener(type: "keydown", listener: (event: KeyboardEvent) => void): void;
  removeEventListener(type: "keydown", listener: (event: KeyboardEvent) => void): void;
}


interface Window {
  localStorage: Storage;
  document: Document;
  crypto: Crypto;
  navigator: Navigator;
  location: {
    href: string;
    pathname: string;
    search: string;
    reload(): void;
  };
  confirm(message?: string): boolean;
  alert(message?: string): void;
}

declare var window: Window & typeof globalThis;
declare var document: Document;
declare var localStorage: Storage;
declare var crypto: Crypto;
declare var navigator: Navigator;

declare function setTimeout(handler: (...args: any[]) => void, timeout?: number, ...args: any[]): number;
declare function clearTimeout(id?: number): void;
declare function setInterval(handler: (...args: any[]) => void, timeout?: number, ...args: any[]): number;
declare function clearInterval(id?: number): void;
declare function requestAnimationFrame(handler: (timestamp: number) => void): number;
declare function cancelAnimationFrame(id?: number): void;