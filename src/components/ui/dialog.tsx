"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as React from "react";

import { cn } from "@/lib/utils/cn";

const DialogRoot = Dialog.Root;
const DialogTrigger = Dialog.Trigger;
const DialogClose = Dialog.Close;
const DialogPortal = Dialog.Portal;
const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof Dialog.Overlay>,
  React.ComponentPropsWithoutRef<typeof Dialog.Overlay>
>(({ className, ...props }, ref) => (
  <Dialog.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-black/50", className)}
    {...props}
  />
));
DialogOverlay.displayName = Dialog.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof Dialog.Content>,
  React.ComponentPropsWithoutRef<typeof Dialog.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <Dialog.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-2xl -translate-x-1/2 -translate-y-1/2",
        "rounded-lg bg-background p-6 shadow-lg",
        className,
      )}
      {...props}
    >
      {children}
    </Dialog.Content>
  </DialogPortal>
));
DialogContent.displayName = Dialog.Content.displayName;

function DialogHeader({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mb-4", className)} {...props}>
      {children}
    </div>
  );
}

function DialogTitle({
  children,
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Dialog.Title>) {
  return (
    <Dialog.Title className={cn("text-lg font-semibold", className)} {...props}>
      {children}
    </Dialog.Title>
  );
}

function DialogFooter({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mt-6 flex justify-end gap-2", className)} {...props}>
      {children}
    </div>
  );
}

export {
  DialogRoot as Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
