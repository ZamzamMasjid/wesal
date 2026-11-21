"use client";

import { X } from "lucide-react";
import { Dialog as RadixDialog } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

// Radix Dialog dressed in the project's tokens (docs/design/patterns.md).
// Focus is trapped, Escape closes, and focus returns to the trigger.

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

export function DialogContent({
  className,
  children,
  closeLabel = "Close",
  ...props
}: React.ComponentProps<typeof RadixDialog.Content> & {
  closeLabel?: string;
}) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-50 bg-overlay" />
      <RadixDialog.Content
        className={cn(
          "fixed start-1/2 top-1/2 z-50 max-h-[85dvh] w-[min(92vw,32rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg bg-surface p-6 shadow-lg focus:outline-none [dir=rtl]:translate-x-1/2",
          className,
        )}
        {...props}
      >
        {children}
        <RadixDialog.Close
          className="absolute end-2 top-2 flex size-(--size-touch-dense) items-center justify-center rounded-full text-muted hover:bg-fill focus-visible:ring-2 focus-visible:ring-focus"
          aria-label={closeLabel}
        >
          <X className="size-5" aria-hidden />
        </RadixDialog.Close>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

export function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof RadixDialog.Title>) {
  return (
    <RadixDialog.Title
      className={cn("text-xl font-bold", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof RadixDialog.Description>) {
  return (
    <RadixDialog.Description
      className={cn("text-sm text-muted", className)}
      {...props}
    />
  );
}
