/**
 * Cards collected before sign-in live on the device until the user creates
 * an account; then they are merged into the binder once (idempotent by
 * `localId`, which the server stores as `clientId`).
 */
import { useCallback, useEffect, useState } from "react";
import { APP_STORAGE_KEYS, type PendingCollectionItem } from "@shared/app";

const KEY = APP_STORAGE_KEYS.pendingCollection;
const LIMIT = 200;
const listeners = new Set<() => void>();

function read(): PendingCollectionItem[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingCollectionItem[]) : [];
  } catch {
    return [];
  }
}

function write(items: PendingCollectionItem[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items.slice(-LIMIT)));
  } catch {
    // Storage blocked: the item still lives in memory for this session.
  }
  listeners.forEach(fn => fn());
}

export function newLocalId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 32);
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function getPending() {
  return read();
}

export function addPending(item: Omit<PendingCollectionItem, "localId" | "createdAt">) {
  const next: PendingCollectionItem = {
    ...item,
    localId: newLocalId(),
    createdAt: new Date().toISOString(),
  };
  write([...read(), next]);
  return next;
}

export function removePending(localIds: string[]) {
  const drop = new Set(localIds);
  write(read().filter(item => !drop.has(item.localId)));
}

export function clearPending() {
  write([]);
}

/** Reactive view of the queue for components. */
export function usePending() {
  const [items, setItems] = useState<PendingCollectionItem[]>(() =>
    typeof window === "undefined" ? [] : read()
  );
  useEffect(() => {
    const update = () => setItems(read());
    listeners.add(update);
    window.addEventListener("storage", update);
    return () => {
      listeners.delete(update);
      window.removeEventListener("storage", update);
    };
  }, []);
  const remove = useCallback((ids: string[]) => removePending(ids), []);
  return { items, remove };
}
