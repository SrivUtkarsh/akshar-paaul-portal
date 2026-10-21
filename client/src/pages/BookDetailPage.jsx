import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpenText, FileImage, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, jsonBody } from '../api.js';
import Loading from '../components/Loading.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const defaultCriteria = () => [
  { name: 'Main ideas', description: 'Captures the main idea or important events from the book.', maxMarks: 5 },
  { name: 'Understanding', description: 'Shows understanding in the student’s own words.', maxMarks: 5 },
  { name: 'Clarity and completeness', description: 'Summary is understandable and sufficiently complete.', maxMarks: 5 },
];

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const TARGET_IMAGE_BYTES = MAX_UPLOAD_BYTES - 64 * 1024;

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The browser could not process this image. Try another photo.'));
    }, 'image/jpeg', quality);
  });
}

async function resizeImageUnderLimit(file) {
  if (file.size < MAX_UPLOAD_BYTES) return file;

  let sourceUrl;
  try {
    sourceUrl = URL.createObjectURL(file);
    const imageElement = new Image();
    imageElement.src = sourceUrl;
    await new Promise((resolve, reject) => {
      imageElement.onload = resolve;
      imageElement.onerror = () => reject(new Error('This image could not be opened. Choose a JPG, PNG, or WEBP image.'));
    });

    let scale = Math.min(1, 2200 / Math.max(imageElement.naturalWidth, imageElement.naturalHeight));
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(imageElement.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(imageElement.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Image resizing is not supported by this browser.');

      // White background keeps transparent PNG/WEBP pages readable after JPEG conversion.
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

      for (const quality of [0.88, 0.80, 0.72, 0.64, 0.56, 0.48]) {
        const blob = await canvasToBlob(canvas, quality);
        if (blob.size < TARGET_IMAGE_BYTES) {
          const baseName = file.name.replace(/\.[^.]+$/, '') || 'student-summary';
          return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
        }
      }
      scale *= 0.82;
    }
    throw new Error('This image could not be reduced below 4 MB. Please choose a smaller photo.');
  } finally {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  }
}


export default function BookDetailPage() {
  const { bookId } = useParams();
  const [book, setBook] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingBook, setEditingBook] = useState(false);
  const [savingBook, setSavingBook] = useState(false);
  const [bookForm, setBookForm] = useState({ title: '', author: '', description: '' });
  const [standardForm, setStandardForm] = useState({ name: 'Book summary rubric', description: 'Reusable rubric for this book.', criteria: defaultCriteria() });
  const [showStandard, setShowStandard] = useState(false);
  const [savingStandard, setSavingStandard] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [student, setStudent] = useState({ studentName: '', studentClass: '', studentSection: '' });
  const [image, setImage] = useState(null);
  const [processingImage, setProcessingImage] = useState(false);
  const [submissionQuery, setSubmissionQuery] = useState('');
  const [submissionStatus, setSubmissionStatus] = useState('all');
  const [submissionDate, setSubmissionDate] = useState('');

  async function load() {
    try {
      const [bookResult, submissionResult] = await Promise.all([api(`/books/${bookId}`), api(`/submissions?bookId=${bookId}`)]);
      setBook(bookResult.book); setSubmissions(submissionResult.submissions);
    } catch (error) { toast.error(error.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [bookId]);

  async function saveBook(event) {
    event.preventDefault();
    setSavingBook(true);
    try {
      const result = await api(`/books/${bookId}`, { method: 'PATCH', body: jsonBody(bookForm) });
      setBook(result.book);
      setEditingBook(false);
      toast.success('Book details updated.');
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSavingBook(false);
    }
  }

  async function saveStandard(event) {
    event.preventDefault(); setSavingStandard(true);
    try {
      await api(`/books/${bookId}/standards`, { method: 'POST', body: jsonBody(standardForm) });
      toast.success('Grading standard saved as a new version.'); setShowStandard(false); await load();
    } catch (error) { toast.error(error.message); }
    finally { setSavingStandard(false); }
  }

  function changeCriterion(index, key, value) {
    setStandardForm((current) => ({ ...current, criteria: current.criteria.map((criterion, i) => i === index ? { ...criterion, [key]: key === 'maxMarks' ? value : value } : criterion) }));
  }
  function addCriterion() {
    if (standardForm.criteria.length >= 20) return toast.error('A standard can have up to 20 criteria.');
    setStandardForm((current) => ({ ...current, criteria: [...current.criteria, { name: '', description: '', maxMarks: 5 }] }));
  }
  function removeCriterion(index) {
    if (standardForm.criteria.length <= 1) return toast.error('Keep at least one criterion.');
    setStandardForm((current) => ({ ...current, criteria: current.criteria.filter((_, i) => i !== index) }));
  }

  async function handleImageSelection(event) {
    const selected = event.target.files?.[0];
    setImage(null);
    if (!selected) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type)) {
      event.target.value = '';
      return toast.error('Choose a JPG, PNG, or WEBP image.');
    }
    if (selected.size < MAX_UPLOAD_BYTES) {
      setImage(selected);
      return;
    }

    setProcessingImage(true);
    try {
      const resized = await resizeImageUnderLimit(selected);
      setImage(resized);
      toast.success(`Image resized to ${(resized.size / 1024 / 1024).toFixed(2)} MB.`);
    } catch (error) {
      event.target.value = '';
      toast.error(error.message || 'Could not resize this image.');
    } finally {
      setProcessingImage(false);
    }
  }

  async function uploadSummary(event) {
    event.preventDefault(); if (!image) return toast.error('Choose a page image first.');
    setUploading(true);
    try {
      const body = new FormData();
      body.append('studentName', student.studentName);
      body.append('studentClass', student.studentClass);
      body.append('studentSection', student.studentSection);
      body.append('image', image);
      const result = await api(`/submissions/for-book/${bookId}`, { method: 'POST', body });
      toast.success(result.message); setStudent({ studentName: '', studentClass: '', studentSection: '' }); setImage(null);
      event.target.reset(); await load();
    } catch (error) { toast.error(error.message); }
    finally { setUploading(false); }
  }

  if (loading) return <Loading label="Opening book…" />;
  if (!book) return <div className="card">Book not found. <Link className="font-bold text-forest" to="/books">Return to books</Link></div>;
  const totalMarks = standardForm.criteria.reduce((sum, item) => sum + (Number(item.maxMarks) || 0), 0);
  const currentStandard = book.latest_standard;
  const visibleSubmissions = submissions.filter((item) => {
    const search = submissionQuery.trim().toLowerCase();
    const matchesSearch = !search || `${item.student_name} ${item.student_class} ${item.student_section} ${item.submitted_by_name || ''}`.toLowerCase().includes(search);
    const matchesStatus = submissionStatus === 'all' || item.status === submissionStatus;
    const matchesDate = !submissionDate || String(item.created_at).slice(0, 10) === submissionDate;
    return matchesSearch && matchesStatus && matchesDate;
  });

  return <div className="space-y-6">
    <Link to="/books" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-forest"><ArrowLeft size={16} /> Back to books</Link>
    <section className="card">
      {!editingBook ? <div className="flex items-start gap-4"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-forest/10 text-forest"><BookOpenText size={25} /></div><div className="min-w-0 flex-1"><h2 className="text-2xl font-extrabold tracking-tight">{book.title}</h2><p className="mt-1 text-sm text-slate-500">{book.author || 'Author not specified'} · Created by {book.creator_name}</p>{book.description && <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{book.description}</p>}</div><button type="button" className="btn-secondary shrink-0" onClick={() => { setBookForm({ title: book.title || '', author: book.author || '', description: book.description || '' }); setEditingBook(true); }}><Pencil size={15} /> Edit book</button></div> : <form onSubmit={saveBook} className="space-y-4"><div><h2 className="section-title">Edit book details</h2><p className="muted mt-1">Update the title, author, or description. Existing grading standards and submissions will be preserved.</p></div><div className="grid gap-4 md:grid-cols-2"><div><label className="label">Book title</label><input className="field" maxLength="220" value={bookForm.title} onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })} required /></div><div><label className="label">Author</label><input className="field" maxLength="180" value={bookForm.author} onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })} /></div><div className="md:col-span-2"><label className="label">Description / note</label><textarea className="field min-h-20" maxLength="12000" value={bookForm.description} onChange={(e) => setBookForm({ ...bookForm, description: e.target.value })} /></div></div><div className="flex flex-wrap gap-2"><button className="btn-primary" disabled={savingBook}>{savingBook ? 'Saving…' : 'Save changes'}</button><button type="button" className="btn-secondary" onClick={() => setEditingBook(false)}>Cancel</button></div></form>}
    </section>

    <section className="card">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><h3 className="section-title">Grading standard</h3><p className="muted mt-1">Reusable criteria keep evaluations consistent. Saving changes creates a new version.</p></div><button className="btn-primary" onClick={() => { setStandardForm(currentStandard ? { name: currentStandard.name, description: currentStandard.description || '', criteria: currentStandard.criteria.map((c) => ({ ...c, maxMarks: Number(c.maxMarks ?? c.max_marks) })) } : { name: 'Book summary rubric', description: '', criteria: defaultCriteria() }); setShowStandard(!showStandard); }}><Plus size={16} /> {currentStandard ? 'Create new version' : 'Set grading standard'}</button></div>
      {currentStandard && <div className="mt-5 rounded-xl bg-paper p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-extrabold">{currentStandard.name} <span className="ml-1 text-xs font-bold text-forest">v{currentStandard.version}</span></p><p className="mt-1 text-sm text-slate-500">{currentStandard.description || 'No description.'}</p></div><p className="text-lg font-extrabold text-forest">{currentStandard.total_marks} marks</p></div><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{currentStandard.criteria.map((criterion, index) => <div key={`${criterion.name}-${index}`} className="rounded-lg border border-slate-200 bg-white p-3"><div className="flex justify-between gap-2"><p className="text-sm font-bold">{criterion.name}</p><p className="shrink-0 text-sm font-extrabold">{criterion.maxMarks ?? criterion.max_marks}</p></div>{criterion.description && <p className="mt-1 text-xs leading-5 text-slate-500">{criterion.description}</p>}</div>)}</div></div>}
      {!currentStandard && <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">This book needs a grading standard before student pages can be uploaded. Add the criteria teachers want the AI to consider.</p>}
      {showStandard && <form onSubmit={saveStandard} className="mt-5 space-y-4 border-t border-slate-100 pt-5"><div className="grid gap-4 md:grid-cols-2"><div><label className="label">Standard name</label><input className="field" maxLength="180" value={standardForm.name} onChange={(e) => setStandardForm({ ...standardForm, name: e.target.value })} required /></div><div><label className="label">Total marks</label><div className="field flex items-center justify-between bg-slate-50 font-extrabold">{totalMarks}<span className="text-xs font-medium text-slate-500">auto-calculated</span></div></div><div className="md:col-span-2"><label className="label">Instructions for the evaluator (optional)</label><textarea className="field min-h-20" maxLength="12000" value={standardForm.description} onChange={(e) => setStandardForm({ ...standardForm, description: e.target.value })} placeholder="What matters most in this book's summary?" /></div></div>
        <div className="space-y-3">{standardForm.criteria.map((criterion, index) => <div key={index} className="rounded-xl border border-slate-200 p-4"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-bold">Criterion {index + 1}</p><button type="button" onClick={() => removeCriterion(index)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove criterion"><Trash2 size={16} /></button></div><div className="grid gap-3 md:grid-cols-[1fr_140px]"><div><label className="label">Criterion name</label><input className="field" maxLength="180" value={criterion.name} onChange={(e) => changeCriterion(index, 'name', e.target.value)} required placeholder="e.g. Main ideas" /></div><div><label className="label">Maximum marks</label><input className="field" type="number" min="0.5" max="1000" step="0.5" value={criterion.maxMarks} onChange={(e) => changeCriterion(index, 'maxMarks', e.target.value)} required /></div><div className="md:col-span-2"><label className="label">What should the teacher look for?</label><textarea className="field min-h-16" maxLength="2000" value={criterion.description} onChange={(e) => changeCriterion(index, 'description', e.target.value)} placeholder="Describe what a good answer includes" /></div></div></div>)}</div>
        <div className="flex flex-wrap justify-between gap-3"><button type="button" onClick={addCriterion} className="btn-secondary"><Plus size={15} /> Add criterion</button><div className="flex gap-2"><button type="button" className="btn-secondary" onClick={() => setShowStandard(false)}>Cancel</button><button className="btn-primary" disabled={savingStandard}>{savingStandard ? 'Saving…' : 'Save standard version'}</button></div></div>
      </form>}
    </section>

    <section className="card">
      <div className="mb-5 flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700"><Upload size={20} /></div><div><h3 className="section-title">Upload a student summary</h3><p className="muted mt-1">Use a clear, well-lit JPG, PNG, or WEBP image under 4 MB.</p></div></div>
      <form onSubmit={uploadSummary} className="grid gap-4 md:grid-cols-3">
        <div><label className="label">Student name</label><input className="field" value={student.studentName} onChange={(e) => setStudent({ ...student, studentName: e.target.value })} required placeholder="Student's name" /></div>
        <div><label className="label">Class / grade (optional)</label><input className="field" value={student.studentClass} onChange={(e) => setStudent({ ...student, studentClass: e.target.value })} placeholder="e.g. Grade 5" /></div>
        <div><label className="label">Section (optional)</label><input className="field" value={student.studentSection} onChange={(e) => setStudent({ ...student, studentSection: e.target.value })} placeholder="e.g. A" /></div>
        <div className="md:col-span-3"><label className="label">Handwritten page photo</label><div className="flex flex-col gap-3 rounded-xl border border-dashed border-slate-300 bg-paper p-4 sm:flex-row sm:items-center"><FileImage size={22} className="text-slate-400" /><input className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-forest file:px-4 file:py-2 file:font-semibold file:text-white" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageSelection} required /><p className="text-xs text-slate-600">{processingImage ? 'Resizing image…' : image ? `${image.name} · ${(image.size / 1024 / 1024).toFixed(2)} MB` : 'Maximum 4 MB; larger images are resized automatically'}</p></div></div>
        <div className="md:col-span-3">{!currentStandard && <p className="mb-3 text-sm font-medium text-rose-700">Set the grading standard above before uploading.</p>}<button className="btn-primary" disabled={uploading || processingImage || !currentStandard}><Upload size={16} /> {processingImage ? 'Resizing image…' : uploading ? 'Saving photo…' : 'Save student submission'}</button></div>
      </form>
    </section>

    <section className="card"><div className="mb-5"><h3 className="section-title">Student submissions</h3><p className="muted mt-1">Filter by student, submitting faculty, status, or date. Open a submission to verify AI suggestions.</p></div>
      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_190px_180px]"><input className="field" value={submissionQuery} onChange={(e) => setSubmissionQuery(e.target.value)} placeholder="Search student or faculty name…" /><select className="field" value={submissionStatus} onChange={(e) => setSubmissionStatus(e.target.value)}><option value="all">All statuses</option><option value="uploaded">Needs AI review</option><option value="ai_reviewed">AI suggestions ready</option><option value="reviewed">Teacher reviewed</option></select><input className="field" type="date" value={submissionDate} onChange={(e) => setSubmissionDate(e.target.value)} aria-label="Filter by submission date" /></div>
      {submissions.length === 0 ? <div className="rounded-xl bg-paper py-8 text-center text-sm text-slate-600">No student summaries uploaded for this book yet.</div> : visibleSubmissions.length === 0 ? <div className="rounded-xl bg-paper py-8 text-center text-sm text-slate-600">No submissions match these filters.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead><tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-600"><th className="pb-3 pr-4">Student</th><th className="pb-3 pr-4">Submitted by</th><th className="pb-3 pr-4">Date</th><th className="pb-3 pr-4">Suggested / final marks</th><th className="pb-3 pr-4">Status</th><th className="pb-3">Action</th></tr></thead><tbody>{visibleSubmissions.map((item) => <tr key={item.id} className="border-b border-slate-100 last:border-0"><td className="py-4 pr-4"><p className="font-bold">{item.student_name}</p><p className="mt-1 text-xs text-slate-500">{item.student_class}{item.student_section ? ` · ${item.student_section}` : ''}</p></td><td className="py-4 pr-4 text-slate-500">{item.submitted_by_name}</td><td className="py-4 pr-4 text-slate-500">{new Date(item.created_at).toLocaleDateString()}</td><td className="py-4 pr-4 font-semibold">{item.final_score ?? item.ai_score ?? '—'}</td><td className="py-4 pr-4"><StatusBadge status={item.status} /></td><td className="py-4"><Link className="font-bold text-forest hover:underline" to={`/submissions/${item.id}`}>Open review →</Link></td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}