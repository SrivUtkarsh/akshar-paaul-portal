import { AlertCircle, RefreshCw } from 'lucide-react';

export default function ErrorState({
  title = 'Something went wrong',
  message = 'We could not load this information. Please try again.',
  onRetry,
  retryLabel = 'Try again',
}) {
  return (
    <section className="card flex flex-col items-start gap-3 border-rose-200 p-6" role="alert">
      <div className="flex items-center gap-2 text-rose-800">
        <AlertCircle size={19} aria-hidden="true" />
        <h2 className="font-bold">{title}</h2>
      </div>
      <p className="max-w-2xl text-sm leading-6 text-slate-600">{message}</p>
      {onRetry && (
        <button type="button" className="btn-secondary mt-1" onClick={onRetry}>
          <RefreshCw size={15} aria-hidden="true" /> {retryLabel}
        </button>
      )}
    </section>
  );
}
