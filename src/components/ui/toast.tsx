"use client";

import * as React from "react";

import { cn } from "@/lib/utils/cn";

export function Toast({
  message,
  variant = "default",
  className,
}: {
  message: string;
  variant?: "default" | "destructive";
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "fixed bottom-4 right-4 z-50 rounded-md px-4 py-3 text-sm shadow-lg",
        variant === "destructive"
          ? "bg-destructive text-destructive-foreground"
          : "bg-background border text-foreground",
        className,
      )}
    >
      {message}
    </div>
  );
}
