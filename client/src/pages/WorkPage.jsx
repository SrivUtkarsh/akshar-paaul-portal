import { useEffect, useState } from 'react';
import { CalendarDays, Check, ChevronDown, ChevronUp, Clock, MessageSquare, PencilLine, Plus, Send, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, jsonBody } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Loading from '../components/Loading.jsx';

const today = () => new Date().toLocaleDateString('en-CA');
const dateText = (value) => String(value || '').slice(0, 10);
const blankForm = () => ({ title: '', workDate: today(), details: '' });

export default function WorkPage() {
  const { user } = useAuth();
  const [work, setWork] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(blankForm());
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [feedbacks, setFeedbacks] = useState({});
  const [expandedHistory, setExpandedHistory] = useState(null);
  const [history, setHistory] = useState({});

  async function loadWork() {
    setLoading(true);
    try {
      const query = user.role === 'admin' && filter !== 'all' ? `?status=${filter}` : '';
      const result = await api(`/work${query}`);
      setWork(result.work);
    } catch (error) { toast.error(error.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { loadWork(); }, [filter, user.role]);

  async function submitWork(event) {
    event.preventDefault(); setSubmitting(true);
    try {
      await api('/work', { method: 'POST', body: jsonBody(form) });
      setForm(blankForm()); toast.success('Daily work submitted.'); await loadWork();
    } catch (error) { toast.error(error.message); }
    finally { setSubmitting(false); }
  }

  async function saveRevision(event) {
    event.preventDefault(); setSubmitting(true);
    try {
      await api(`/work/${editing.id}`, { method: 'PATCH', body: jsonBody(editing.form) });
      setEditing(null); toast.success('Updated activity sent for review.'); await loadWork();
    } catch (error) { toast.error(error.message); }
    finally { setSubmitting(false); }
  }

  async function review(item, action) {
    try {
      await api(`/work/${item.id}/review`, { method: 'POST', body: jsonBody({ action, feedback: feedbacks[item.id] || '' }) });
      toast.success(action === 'approved' ? 'Activity approved.' : 'Changes requested.'); await loadWork();
    } catch (error) { toast.error(error.message); }
  }

  async function toggleHistory(id) {
    if (expandedHistory === id) { setExpandedHistory(null); return; }
    setExpandedHistory(id);
    if (!history[id]) {
      try { const result = await api(`/work/${id}/history`); setHistory((prev) => ({ ...prev, [id]: result })); }
      catch (error) { toast.error(error.message); }
    }
  }

  if (loading) return <Loading label="Loading daily work…" />;
  return <div className="space-y-6">
    {user.role === 'faculty' && <section className="card">
      <div className="mb-5 flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest/10 text-forest"><Plus size={20} /></div><div><h2 className="section-title">Submit today's work</h2><p className="muted mt-1">A short, clear record helps administrators review your activity.</p></div></div>
      <form onSubmit={submitWork} className="grid gap-4 md:grid-cols-2">
        <div><label className="label">Activity title</label><input className="field" maxLength="180" placeholder="e.g. Reading session with Grade 4" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
        <div><label className="label">Date</label><input className="field" type="date" value={form.workDate} onChange={(e) => setForm({ ...form, workDate: e.target.value })} required /></div>
        <div className="md:col-span-2"><label className="label">What did you do?</label><textarea className="field min-h-28 resize-y" maxLength="12000" placeholder="Share what was completed, who participated, and any follow-up needed…" value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} required /></div>
        <div className="md:col-span-2"><button className="btn-primary" disabled={submitting}><Send size={16} /> {submitting ? 'Submitting…' : 'Submit for review'}</button></div>
      </form>
    </section>}

    <section className="card">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="section-title">{user.role === 'admin' ? 'Faculty activity submissions' : 'My activity history'}</h2><p className="muted mt-1">{user.role === 'admin' ? 'Approve a submission or explain what needs to change.' : 'Check your status and respond to administrator feedback.'}</p></div>
        {user.role === 'admin' && <select className="field w-auto min-w-44" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="changes_requested">Changes requested</option><option value="approved">Approved</option></select>}
      </div>
      {work.length === 0 ? <div className="rounded-xl bg-paper px-4 py-10 text-center"><CalendarDays size={26} className="mx-auto mb-2 text-slate-300" /><p className="text-sm font-semibold text-slate-600">No activity found</p><p className="mt-1 text-sm text-slate-600">{user.role === 'admin' ? 'Try a different filter, or wait for faculty submissions.' : 'Your submitted work will appear here.'}</p></div> : <div className="space-y-4">
        {work.map((item) => <article key={item.id} className="rounded-2xl border border-slate-200 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-slate-900">{item.title}</h3><StatusBadge status={item.status} /></div><p className="mt-1 text-xs text-slate-500">{user.role === 'admin' ? `${item.faculty_name} · ` : ''}{dateText(item.work_date)} · Submitted {new Date(item.submitted_at).toLocaleDateString()}</p></div><button onClick={() => toggleHistory(item.id)} className="btn-secondary px-3 py-2"><Clock size={15} /> History {expandedHistory === item.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button></div>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.details}</p>
          {item.latest_feedback && <div className="mt-4 flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><MessageSquare size={17} className="mt-0.5 shrink-0" /><div><p className="font-bold">Administrator feedback</p><p className="mt-1 whitespace-pre-wrap">{item.latest_feedback}</p></div></div>}
          {user.role === 'admin' && item.status !== 'approved' && <div className="mt-5 border-t border-slate-100 pt-4"><label className="label">Comment (required when requesting changes)</label><textarea className="field min-h-20" placeholder="A short note for the faculty member…" value={feedbacks[item.id] || ''} onChange={(e) => setFeedbacks({ ...feedbacks, [item.id]: e.target.value })} /><div className="mt-3 flex flex-wrap gap-2"><button onClick={() => review(item, 'approved')} className="btn-primary"><Check size={16} /> Approve</button><button onClick={() => review(item, 'changes_requested')} className="btn-secondary"><PencilLine size={16} /> Request changes</button></div></div>}
          {user.role === 'faculty' && item.status === 'changes_requested' && <div className="mt-4"><button className="btn-primary" onClick={() => setEditing({ id: item.id, form: { title: item.title, workDate: dateText(item.work_date), details: item.details } })}><PencilLine size={16} /> Edit and resubmit</button></div>}
          {expandedHistory === item.id && <div className="mt-5 border-t border-slate-100 pt-4"><h4 className="mb-3 text-sm font-bold">Decision and revision history</h4>{!history[item.id] ? <p className="text-sm text-slate-500">Loading history…</p> : <div className="space-y-3">{history[item.id].reviews.map((review) => <div key={`review-${review.id}`} className="rounded-xl bg-slate-50 p-3 text-sm"><p className="font-bold">{review.admin_name}: {review.action.replaceAll('_', ' ')}</p><p className="mt-1 text-slate-600">{review.feedback || 'No comment added.'}</p><p className="mt-1 text-xs text-slate-600">{new Date(review.created_at).toLocaleString()}</p></div>)}{history[item.id].revisions.map((revision) => <div key={`revision-${revision.id}`} className="rounded-xl bg-slate-50 p-3 text-sm"><p className="font-bold">Previous version · {revision.saved_by_name}</p><p className="mt-1 text-slate-600">{revision.title} — {dateText(revision.work_date)}</p><p className="mt-1 line-clamp-3 text-slate-600">{revision.details}</p></div>)}{history[item.id].reviews.length + history[item.id].revisions.length === 0 && <p className="text-sm text-slate-500">No previous decisions or revisions yet.</p>}</div>}</div>}
        </article>)}
      </div>}
    </section>

    {editing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"><div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"><div className="mb-5 flex justify-between gap-4"><div><h2 className="text-xl font-extrabold">Update activity</h2><p className="muted mt-1">Your earlier version will remain in history.</p></div><button onClick={() => setEditing(null)} className="text-slate-400"><X /></button></div><form onSubmit={saveRevision} className="space-y-4"><div><label className="label">Title</label><input className="field" value={editing.form.title} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, title: e.target.value } })} required /></div><div><label className="label">Date</label><input type="date" className="field" value={editing.form.workDate} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, workDate: e.target.value } })} required /></div><div><label className="label">Details</label><textarea className="field min-h-32" value={editing.form.details} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, details: e.target.value } })} required /></div><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button><button className="btn-primary" disabled={submitting}>Resubmit</button></div></form></div></div>}
  </div>;
}
