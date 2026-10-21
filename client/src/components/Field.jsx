import { useId } from 'react';

/** Accessible labelled form control. Pass `as="textarea"` or `as="select"` when needed. */
export default function Field({
  label,
  id,
  hint,
  error,
  as = 'input',
  className = '',
  children,
  ...props
}) {
  const generatedId = useId();
  const controlId = id || `field-${generatedId}`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const Component = as;
  const describedBy = [props['aria-describedby'], hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="min-w-0 space-y-1.5">
      {label && <label className="label" htmlFor={controlId}>{label}</label>}
      <Component
        {...props}
        id={controlId}
        className={`field ${error ? 'border-rose-600 focus:border-rose-700 focus:ring-rose-600/15' : ''} ${className}`.trim()}
        aria-invalid={error ? 'true' : props['aria-invalid']}
        aria-describedby={describedBy}
      >
        {as === 'textarea' || as === 'select' ? children : undefined}
      </Component>
      {hint && <p id={hintId} className="text-xs leading-5 text-slate-600">{hint}</p>}
      {error && <p id={errorId} className="text-xs font-medium leading-5 text-rose-700" role="alert">{error}</p>}
    </div>
  );
}
