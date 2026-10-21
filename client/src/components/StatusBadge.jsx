const styles = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  changes_requested: 'bg-rose-50 text-rose-700 ring-rose-200',
  uploaded: 'bg-slate-100 text-slate-600 ring-slate-200',
  ai_reviewed: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  reviewed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
};
const labels = {
  changes_requested: 'Changes requested', ai_reviewed: 'AI suggestions ready',
  uploaded: 'Needs AI review', reviewed: 'Teacher reviewed',
};

export default function StatusBadge({ status }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${styles[status] || styles.pending}`}>{labels[status] || String(status || 'pending').replaceAll('_', ' ')}</span>;
}
