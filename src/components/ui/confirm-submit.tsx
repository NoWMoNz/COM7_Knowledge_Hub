"use client";

import { useRef, useState } from "react";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/**
 * Wraps a destructive form action in a confirmation dialog. It does not change what the form does:
 * on confirm it calls `form.requestSubmit()`, so the original server action / useActionState handler runs as before.
 * Place it INSIDE the <form> that holds the action.
 */
export function ConfirmSubmit({
  label,
  title,
  description,
  confirmLabel = "ยืนยัน / Confirm",
  variant = "destructive",
  size = "sm",
  disabled,
}: {
  label: React.ReactNode;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  variant?: "destructive" | "outline" | "ghost";
  size?: "sm" | "xs" | "default" | "icon-sm";
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);

  return (
    <>
      <Button ref={anchor} type="button" variant={variant} size={size} disabled={disabled} onClick={() => setOpen(true)}
        className={variant === "ghost" ? "text-slate-400 hover:bg-red-50 hover:text-red-700" : undefined}>
        {label}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก / Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                setOpen(false);
                anchor.current?.form?.requestSubmit();
              }}
            >
              {confirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
