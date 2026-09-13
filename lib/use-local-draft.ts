'use client';
import { useEffect, useRef, useState, type SetStateAction } from 'react';

// Drafts stay in this browser tab. Saved business records still live on the server.
export function useLocalDraft<T>(key: string | null, initial: T, valid: (value: unknown) => value is T) {
  const [value, setValue] = useState(initial);
  const current = useRef(initial);
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [restored, setRestored] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    if (key) {
      try {
        const raw = sessionStorage.getItem(key);
        if (raw) {
          const draft = JSON.parse(raw);
          if (draft.version === 1 && Date.now() - draft.at < 7 * 86400000 && valid(draft.value)) {
            current.current = draft.value;
            // eslint-disable-next-line react/react-compiler -- Restore tab storage only after hydration; storage is unavailable on the server.
            setValue(draft.value); setDirty(true); setRestored(true);
          } else sessionStorage.removeItem(key);
        }
      } catch { setUnavailable(true); }
    } else setUnavailable(true);
    setReady(true);
  }, [key, valid]);
  function update(action: SetStateAction<T>) {
    if (!ready) return;
    const next = typeof action === 'function' ? (action as (previous: T) => T)(current.current) : action;
    current.current = next; setValue(next); setDirty(true);
    if (key) {
      try { sessionStorage.setItem(key, JSON.stringify({version:1, at:Date.now(), value:next})); setUnavailable(false); }
      catch { setUnavailable(true); }
    }
  }
  function saved(next?: T, expected?: T) {
    if (expected !== undefined && current.current !== expected) return;
    if (key) { try { sessionStorage.removeItem(key); } catch { setUnavailable(true); } }
    if (next !== undefined) { current.current=next; setValue(next); }
    setDirty(false); setRestored(false);
  }
  return {value, update, saved, discard:()=>saved(initial), ready, dirty, restored, unavailable};
}
