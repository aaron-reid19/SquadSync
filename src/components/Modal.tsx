import { useEffect, useRef, type ReactNode } from "react";

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Native <dialog>: focus trap and Esc-to-close come for free. */
export default function Modal({ open, title, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className="policy modal" aria-labelledby="modal-title" onClose={onClose}>
      {open && (
        <>
          <div className="modal__head">
            <h2 id="modal-title" className="policy__title">{title}</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
          </div>
          <div className="modal__body">{children}</div>
        </>
      )}
    </dialog>
  );
}
