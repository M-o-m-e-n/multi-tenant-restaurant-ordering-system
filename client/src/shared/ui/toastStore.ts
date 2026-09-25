import { create } from 'zustand';

export interface Toast {
  id: number;
  title: string;
  detail?: string;
  imageUrl?: string | null;
  action?: { label: string; run: () => void };
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
}

const LIFETIME_MS = 3800;
let next = 1;

/**
 * Short confirmations ("Added to your order · Undo"). At most three are kept;
 * each dismisses itself. The Toaster announces them politely to screen readers.
 */
export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = next++;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id }] }));
    setTimeout(() => get().dismiss(id), LIFETIME_MS);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = (t: Omit<Toast, 'id'>) => useToasts.getState().push(t);
