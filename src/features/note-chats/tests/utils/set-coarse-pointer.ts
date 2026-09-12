import { vi } from "vitest";

export function setCoarsePointer(matches: boolean) {
  window.matchMedia = vi.fn(() => ({
    matches,
  })) as unknown as typeof window.matchMedia;
}
