import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, BookOpenText, Plus, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, jsonBody } from '../api.js';
import Loading from '../components/Loading.jsx';

export default function BooksPage() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', author: '', description: '' });

  async function loadBooks() {
    try { const result = await api('/books'); setBooks(result.books); }
    catch (error) { toast.error(error.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { loadBooks(); }, []);

  async function createBook(event) {
    event.preventDefault(); setSaving(true);
    try {
      await api('/books', { method: 'POST', body: jsonBody(form) });
      setForm({ title: '', author: '', description: '' }); setShowForm(false);
      toast.success('Book created. Next, add its grading standard.'); await loadBooks();
    } catch (error) { toast.error(error.message); }
    finally { setSaving(false); }
  }

  if (loading) return <Loading label="Loading book library…" />;
  const filtered = books.filter((book) => `${book.title} ${book.author}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="space-y-6">
    <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="section-title">Book library</h2><p className="muted mt-1">Each book can have its own reusable grading standard.</p></div><button className="btn-primary" onClick={() => setShowForm(!showForm)}><Plus size={17} /> Add a book</button></section>
    {showForm && <section className="card"><h3 className="section-title">Add a book or reading activity</h3><form onSubmit={createBook} className="mt-4 grid gap-4 md:grid-cols-2"><div><label className="label">Book title</label><input className="field" maxLength="220" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. The Very Hungry Caterpillar" required /></div><div><label className="label">Author</label><input className="field" maxLength="180" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} placeholder="Author name (optional)" /></div><div className="md:col-span-2"><label className="label">Short note (optional)</label><textarea className="field min-h-20" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Age group, reading objective, or context" /></div><div className="flex flex-wrap gap-2 md:col-span-2"><button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Create book'}</button><button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button></div></form></section>}
    <div className="relative"><Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input className="field pl-10" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by book title or author…" /></div>
    {filtered.length === 0 ? <div className="card py-14 text-center"><BookOpenText size={31} className="mx-auto mb-3 text-slate-300" /><h3 className="font-bold">{query ? 'No matching books' : 'Your book library is empty'}</h3><p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{query ? 'Try a different search.' : 'Add your first book, then define the criteria teachers will use for student summaries.'}</p></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {filtered.map((book) => <article key={book.id} className="card flex flex-col transition hover:-translate-y-0.5 hover:border-slate-300"><div className="mb-4 flex items-start justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-forest/10 text-forest"><BookOpenText size={21} /></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{book.submission_count} submissions</span></div><h3 className="text-lg font-extrabold leading-snug">{book.title}</h3><p className="mt-1 text-sm text-slate-500">{book.author || 'Author not specified'}</p>{book.description && <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{book.description}</p>}
        <div className="mt-5 flex-1 rounded-xl bg-paper p-3">{book.latest_standard ? <><p className="text-xs font-bold uppercase tracking-wide text-forest">Grading standard · v{book.latest_standard.version}</p><p className="mt-1 text-sm font-semibold">{book.latest_standard.name}</p><p className="mt-1 text-xs text-slate-500">{book.latest_standard.criteria?.length || 0} criteria · {book.latest_standard.total_marks} total marks</p></> : <><p className="text-sm font-bold text-amber-800">Grading standard not set</p><p className="mt-1 text-xs leading-5 text-amber-700">Add a rubric before uploading student summaries.</p></>}</div>
        <Link to={`/books/${book.id}`} className="btn-secondary mt-4 w-full">Open book <ArrowUpRight size={16} /></Link>
      </article>)}
    </div>}
  </div>;
}
