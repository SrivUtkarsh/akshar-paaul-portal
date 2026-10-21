import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpenText, CheckCircle2, ClipboardList, Clock3, GraduationCap, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Loading from '../components/Loading.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const dateLabel = (value) => value ? String(value).slice(0, 10) : '—';

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState({ work: [], books: [], submissions: [], users: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api('/work'), api('/books'), api('/submissions'), user.role === 'admin' ? api('/users') : Promise.resolve({ users: [] })])
      .then(([work, books, submissions, users]) => setData({ work: work.work, books: books.books, submissions: submissions.submissions, users: users.users }))
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading label="Loading your overview…" />;
  const pending = data.work.filter((item) => item.status === 'pending').length;
  const waitingReview = data.submissions.filter((item) => item.status !== 'reviewed').length;
  const stats = user.role === 'admin' ? [
    { label: 'Pending work', value: pending, note: 'Need your attention', icon: ClipboardList, tone: 'amber' },
    { label: 'Faculty members', value: data.users.filter((item) => item.role === 'faculty' && item.active).length, note: 'Active accounts', icon: GraduationCap, tone: 'green', href: '/team' },
    { label: 'Books in portal', value: data.books.length, note: 'Reusable grading standards', icon: BookOpenText, tone: 'blue', href: '/books' },
    { label: 'Student submissions', value: data.submissions.length, note: `${waitingReview} awaiting teacher review`, icon: CheckCircle2, tone: 'purple', href: '/books' },
  ] : [
    { label: 'My activities', value: data.work.length, note: `${pending} pending approval`, icon: ClipboardList, tone: 'amber', href: '/work' },
    { label: 'Books available', value: data.books.length, note: 'Choose a book to review', icon: BookOpenText, tone: 'green', href: '/books' },
    { label: 'Student submissions', value: data.submissions.length, note: `${waitingReview} need review`, icon: CheckCircle2, tone: 'blue', href: '/books' },
    { label: 'Review complete', value: data.submissions.filter((item) => item.status === 'reviewed').length, note: 'Final teacher decision saved', icon: Clock3, tone: 'purple', href: '/books' },
  ];
  const tone = { amber: 'bg-amber-50 text-amber-700', green: 'bg-emerald-50 text-emerald-700', blue: 'bg-sky-50 text-sky-700', purple: 'bg-violet-50 text-violet-700' };

  return <div className="space-y-7">
    <section className="relative overflow-hidden rounded-3xl bg-forest p-6 text-white shadow-soft sm:p-8">
      <div className="absolute -right-6 -top-16 h-64 w-64 rounded-full border-[34px] border-white/5" />
      <div className="relative max-w-2xl"><p className="text-sm font-semibold text-white/70">Your workspace</p><h2 className="mt-2 text-3xl font-extrabold tracking-tight">Hello, {user.name.split(' ')[0]}.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-white/75">{user.role === 'admin' ? 'Review faculty activity, share clear feedback, and keep team records moving.' : 'Keep your daily work up to date and give every student a consistent, thoughtful book review.'}</p>
        <div className="mt-6 flex flex-wrap gap-3">{user.role === 'admin' ? <Link className="btn bg-sun text-slate-900 hover:bg-amber-300" to="/work">Review daily work <ArrowRight size={16} /></Link> : <><Link className="btn bg-sun text-slate-900 hover:bg-amber-300" to="/work"><Plus size={16} /> Add daily work</Link><Link className="btn border border-white/25 bg-white/10 text-white hover:bg-white/15" to="/books"><BookOpenText size={16} /> Review a book</Link></>}</div>
      </div>
    </section>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((item) => { const Icon = item.icon; return <Link to={item.href || '/'} key={item.label} className="card transition hover:-translate-y-0.5 hover:border-slate-300"><div className="flex items-start justify-between"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone[item.tone]}`}><Icon size={19} /></span><ArrowRight size={16} className="text-slate-300" /></div><p className="mt-5 text-sm font-medium text-slate-500">{item.label}</p><p className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">{item.value}</p><p className="mt-1 text-xs text-slate-400">{item.note}</p></Link>; })}
    </section>

    <section className="grid gap-5 xl:grid-cols-2">
      <div className="card">
        <div className="mb-5 flex items-center justify-between gap-3"><div><h3 className="section-title">Recent daily work</h3><p className="muted mt-1">Latest activity records</p></div><Link to="/work" className="text-sm font-bold text-forest">View all</Link></div>
        {data.work.length === 0 ? <Empty text="No activity submitted yet." link="/work" label={user.role === 'admin' ? 'Open work review' : 'Submit first activity'} /> : <div className="divide-y divide-slate-100">{data.work.slice(0, 4).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{item.title}</p><p className="mt-1 text-xs text-slate-500">{user.role === 'admin' ? `${item.faculty_name} · ` : ''}{dateLabel(item.work_date)}</p></div><StatusBadge status={item.status} /></div>)}</div>}
      </div>
      <div className="card">
        <div className="mb-5 flex items-center justify-between gap-3"><div><h3 className="section-title">Recent student reviews</h3><p className="muted mt-1">Book summaries and assessment status</p></div><Link to="/books" className="text-sm font-bold text-forest">View books</Link></div>
        {data.submissions.length === 0 ? <Empty text="No handwritten summaries uploaded yet." link="/books" label="Browse books" /> : <div className="divide-y divide-slate-100">{data.submissions.slice(0, 4).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{item.student_name}</p><p className="mt-1 truncate text-xs text-slate-500">{item.book_title} · {dateLabel(item.created_at)}</p></div><StatusBadge status={item.status} /></div>)}</div>}
      </div>
    </section>
    <p className="text-xs leading-5 text-slate-400">AI-generated marks are suggestions only. Teachers should verify the extracted handwriting and save the final assessment.</p>
  </div>;
}

function Empty({ text, link, label }) {
  return <div className="rounded-xl bg-paper px-4 py-8 text-center"><p className="text-sm text-slate-500">{text}</p><Link to={link} className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-forest">{label} <ArrowRight size={14} /></Link></div>;
}
