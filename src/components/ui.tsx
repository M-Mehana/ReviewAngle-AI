"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  ar = false,
  dir,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  ar?: boolean;
  dir?: "rtl" | "ltr";
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="modal" dir={dir ?? (ar ? "rtl" : "ltr")}>
          <div className="modal-head">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>
                {description ||
                  (ar
                    ? "راجع التفاصيل والأدلة المرتبطة بها."
                    : "Review the details and their supporting evidence.")}
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="icon-button"
              aria-label={ar ? "إغلاق" : "Close"}
            >
              <X size={20} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Spinner() {
  return <LoaderCircle className="spin" size={18} aria-hidden />;
}
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-mark">“</div>
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </div>
  );
}
