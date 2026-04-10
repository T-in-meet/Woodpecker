/**
 * Imperative toast utility
 *
 * Usage: showToast(message, variant) from event handlers
 *
 * Design:
 * - NOT a React hook (no useState, useEffect)
 * - Imperative: called directly from event handlers
 * - Creates Portal on demand, renders Toast component, auto-unmounts
 * - No JSX conditional rendering (prevents client-state coupling)
 *
 * Reason:
 * - Toast component is a display primitive
 * - Conditional rendering would require state management
 * - Imperative approach decouples toast from component state
 */

import React from "react";
import { createRoot } from "react-dom/client";

import { Toast } from "@/components/ui/toast";

/**
 * Display a toast message imperatively
 *
 * @param message - message to display
 * @param variant - "default" | "destructive" (optional, defaults to "default")
 * @param duration - how long to show toast in ms (optional, defaults to 3000)
 *
 * Example:
 * try {
 *   await submitForm();
 * } catch {
 *   showToast("Failed to submit", "destructive");
 * }
 */
export function showToast(
  message: string,
  variant: "default" | "destructive" = "default",
  duration = 3000,
): void {
  // Create a temporary container
  const container = document.createElement("div");
  document.body.appendChild(container);

  // Create root and render Toast using React.createElement
  const root = createRoot(container);

  root.render(React.createElement(Toast, { variant, message }));

  // Auto-unmount after duration
  setTimeout(() => {
    root.unmount();
    document.body.removeChild(container);
  }, duration);
}
