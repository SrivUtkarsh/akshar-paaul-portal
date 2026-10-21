export default function Loading({ label = 'Loading…' }) {
  return (
    <div className="flex items-center gap-3 py-12 text-sm font-medium text-slate-600" role="status" aria-live="polite" aria-atomic="true">
      <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-forest/20 border-t-forest motion-reduce:animate-none" />
      <span>{label}</span>
    </div>
  );
}
