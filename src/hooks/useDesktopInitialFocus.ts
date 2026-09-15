"use client";

import { useCallback, useEffect, useRef } from "react";

/** Mount-time device policy: never focus before hydration or again after resize. */
export function useDesktopInitialFocus() {
  const allowed = useRef<boolean | null>(null);
  const focused = useRef(false);

  const focusOnce = useCallback((focus: () => void) => {
    allowed.current ??=
      window.matchMedia?.("(min-width: 768px) and (pointer: fine)").matches ??
      false;
    if (!allowed.current || focused.current) return;
    focused.current = true;
    focus();
  }, []);

  useEffect(() => {
    allowed.current ??=
      window.matchMedia?.("(min-width: 768px) and (pointer: fine)").matches ??
      false;
  }, []);

  return focusOnce;
}
