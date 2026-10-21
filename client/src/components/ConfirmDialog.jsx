import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

/** Native modal confirmation dialog; actions remain owned by the calling page. */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  busy = false,
  onConfirm,
  onClose,
  tone = 'danger',
}) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  function handleCancel(event) {
    event.preventDefault();
    if (!busy) onClose?.();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      onCancel={handleCancel}
      onClick={(event) => {
        if (event.target === dialogRef.current && !busy) onClose?.();
      }}
      className="w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-slate-200 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/45"
    >
      <div className="p-6 sm:p-7">
        <div className="mb-4 flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone === 'danger' ? 'bg-rose-100 text-rose-700' : 'bg-forest/10 text-forest'}`}>
            <AlertTriangle size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0 pt-0.5">
            <h2 id="confirm-dialog-title" className="text-lg font-extrabold">{title}</h2>
            <p id="confirm-dialog-description" className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{description}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button ref={cancelRef} type="button" className="btn-secondary justify-center" onClick={onClose} disabled={busy}>{cancelLabel}</button>
          <button type="button" className={tone === 'danger' ? 'btn-danger justify-center' : 'btn-primary justify-center'} onClick={onConfirm} disabled={busy}>
            {busy ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
