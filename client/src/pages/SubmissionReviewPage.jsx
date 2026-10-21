import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, FileText, Image as ImageIcon, RefreshCw, Save, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, jsonBody } from '../api.js';
import Loading from '../components/Loading.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

function startingCriteria(submission) {
  // Prefer the final teacher-entered marks, then the model suggestions, then a blank rubric.
  if (submission.final_criteria?.length) return submission.final_criteria;
  if (submission.ai_criteria?.length) return submission.ai_criteria;
  const rubric = submission.standard_snapshot?.criteria || [];
  return rubric.map((item) => ({ name: item.name, maxMarks: Number(item.maxMarks ?? item.max_marks), marks: 0, evidence: '', feedback: '' }));
}

export default function SubmissionReviewPage() {
  const { submissionId } = useParams();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [transcribing, setTranscribing] = useState(false);
  const [grading, setGrading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const imageUrlRef = useRef('');
  const [extractedText, setExtractedText] = useState('');
  const [finalFeedback, setFinalFeedback] = useState('');
  const [criteria, setCriteria] = useState([]);

  async function load() {
    setLoading(true);
    try {
      const [result, imageBlob] = await Promise.all([
        api(`/submissions/${submissionId}`),
        api(`/submissions/${submissionId}/image`),
      ]);
      setSubmission(result.submission);
      setExtractedText(result.submission.extracted_text || '');
      setFinalFeedback(result.submission.final_feedback || result.submission.ai_feedback || '');
      setCriteria(startingCriteria(result.submission));
      const url = URL.createObjectURL(imageBlob);
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
      imageUrlRef.current = url;
      setImageUrl(url);
    } catch (error) { toast.error(error.message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    return () => {
      // Release the temporary browser URL when navigating away from the submission.
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
      imageUrlRef.current = '';
    };
  }, [submissionId]);

  const totalScore = useMemo(() => criteria.reduce((sum, item) => sum + (Number(item.marks) || 0), 0), [criteria]);
  const totalMax = Number(submission?.standard_snapshot?.totalMarks ?? submission?.standard_snapshot?.total_marks ?? 0);

  async function runTranscription() {
    setTranscribing(true);
    try {
      const result = await api(`/submissions/${submissionId}/transcribe`, { method: 'POST', body: jsonBody({}) });
      setExtractedText(result.submission.extracted_text || '');
      setSubmission((current) => current ? { ...current, ...result.submission } : current);
      toast.success(result.message);
      if (result.uncertaintyNotes) toast(result.uncertaintyNotes, { duration: 7000 });
    } catch (error) { toast.error(error.message); }
    finally { setTranscribing(false); }
  }

  async function runGrading() {
    if (!extractedText.trim()) return toast.error('Transcribe or enter the student text first.');
    setGrading(true);
    try {
      const result = await api(`/submissions/${submissionId}/grade`, {
        method: 'POST', body: jsonBody({ extractedText }),
      });
      toast.success(result.message);
      await load();
    } catch (error) { toast.error(error.message); }
    finally { setGrading(false); }
  }

  function changeCriterion(index, key, value) {
    setCriteria((current) => current.map((item, i) => i === index ? { ...item, [key]: value } : item));
  }

  async function saveFinal(event) {
    event.preventDefault();
    if (totalScore > totalMax) return toast.error(`Marks add up to ${totalScore}; the maximum is ${totalMax}.`);
    setSaving(true);
    try {
      const result = await api(`/submissions/${submissionId}/final`, {
        method: 'PATCH',
        body: jsonBody({ extractedText, finalScore: totalScore, finalFeedback, finalCriteria: criteria }),
      });
      toast.success(result.message); await load();
    } catch (error) { toast.error(error.message); }
    finally { setSaving(false); }
  }

  if (loading) return <Loading label="Opening student submission…" />;
  if (!submission) return <div className="card">Submission not found. <Link className="font-bold text-forest" to="/books">Return to books</Link></div>;
  const rubricName = submission.standard_snapshot?.name || 'Grading standard';
  const rubricVersion = submission.standard_snapshot?.version;

  return <div className="space-y-6">
    <Link to={`/books/${submission.book_id}`} className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-forest"><ArrowLeft size={16} /> Back to {submission.book_title}</Link>
    <section className="card"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-2xl font-extrabold tracking-tight">{submission.student_name}</h2><StatusBadge status={submission.status} /></div><p className="mt-1 text-sm text-slate-500">{submission.book_title} · {submission.student_class || 'Class not specified'}{submission.student_section ? ` · ${submission.student_section}` : ''}</p><p className="mt-1 text-xs text-slate-600">Uploaded {new Date(submission.created_at).toLocaleString()} · Standard: {rubricName}{rubricVersion ? ` v${rubricVersion}` : ''}</p></div><div className="rounded-xl bg-paper px-4 py-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{submission.status === 'reviewed' ? 'Final teacher marks' : 'AI suggested marks'}</p><p className="mt-1 text-3xl font-extrabold text-forest">{submission.status === 'reviewed' ? submission.final_score : submission.ai_score ?? '—'}<span className="ml-1 text-base font-semibold text-slate-600">/ {totalMax}</span></p></div></div></section>

    <section className="grid items-start gap-5 xl:grid-cols-[.9fr_1.1fr]">
      <div className="card"><div className="mb-4 flex items-center gap-2"><ImageIcon size={18} className="text-forest" /><h3 className="section-title">Original handwritten page</h3></div><div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">{imageUrl ? <img src={imageUrl} alt={`Handwritten summary from ${submission.student_name}`} className="mx-auto max-h-[720px] w-full object-contain" /> : <div className="p-12 text-center text-sm text-slate-600">Image could not be loaded.</div>}</div><p className="mt-3 text-xs leading-5 text-slate-600">Check the original page whenever you correct the extracted text or suggested marks.</p><div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 p-4"><div className="flex items-center gap-2 text-indigo-800"><Sparkles size={18} /><p className="text-sm font-extrabold">AI-assisted review</p></div><p className="mt-2 text-sm leading-6 text-indigo-900/75">Use two steps for better Hindi and Marathi results: extract the text, correct it against the photo, then ask AI to grade that corrected text. AI marks are suggestions only.</p><button type="button" onClick={runTranscription} className="btn mt-4 w-full bg-indigo-600 text-white hover:bg-indigo-700" disabled={transcribing || grading || submission.status === 'reviewed'}><RefreshCw size={16} className={transcribing ? 'animate-spin' : ''} />{transcribing ? 'Reading handwriting…' : submission.status === 'reviewed' ? 'Final assessment already saved' : '1. Extract text from photo'}</button><button type="button" onClick={runGrading} className="btn mt-2 w-full border border-indigo-300 bg-white text-indigo-800 hover:bg-indigo-100" disabled={transcribing || grading || submission.status === 'reviewed' || !extractedText.trim()}><Sparkles size={16} className={grading ? 'animate-pulse' : ''} />{grading ? 'Evaluating corrected text…' : '2. Suggest marks from corrected text'}</button></div></div>

      <form onSubmit={saveFinal} className="space-y-5">
        <section className="card"><div className="mb-4 flex items-center gap-2"><FileText size={18} className="text-forest" /><h3 className="section-title">Extracted text</h3></div><p className="mb-3 text-sm leading-6 text-slate-500">Correct any reading mistakes here before clicking “Suggest marks from corrected text”. The AI will grade this text, not re-read the image. Keep the student's original language when possible.</p><textarea className="field min-h-64 resize-y leading-7" value={extractedText} onChange={(e) => setExtractedText(e.target.value)} placeholder="Run the AI review to extract the handwritten text, or type a teacher-verified transcription here…" /><p className="mt-2 text-xs text-slate-600">Detected language: {submission.detected_language || 'Not detected yet'}</p></section>

        <section className="card"><div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h3 className="section-title">Criterion-wise assessment</h3><p className="muted mt-1">Edit marks and feedback to match your professional judgement.</p></div><div className="rounded-lg bg-paper px-3 py-2 text-sm font-extrabold">{totalScore} / {totalMax}</div></div>
          <div className="space-y-4">{criteria.map((item, index) => <div key={`${item.name}-${index}`} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start"><div><p className="font-bold">{item.name}</p><p className="mt-1 text-xs text-slate-500">Maximum {item.maxMarks} marks</p></div><div className="flex items-center gap-2"><label htmlFor={`marks-${index}`} className="text-xs font-bold text-slate-500">Marks</label><input id={`marks-${index}`} type="number" step="0.5" min="0" max={item.maxMarks} className="field w-24 py-2 text-center font-bold" value={item.marks ?? 0} onChange={(e) => changeCriterion(index, 'marks', e.target.value)} /></div></div>{item.evidence && <div className="mt-3 rounded-lg bg-paper p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">Evidence noticed</p><p className="mt-1 text-sm leading-5 text-slate-600">{item.evidence}</p></div>}<div className="mt-3"><label className="label">Criterion feedback</label><textarea className="field min-h-16" value={item.feedback || ''} onChange={(e) => changeCriterion(index, 'feedback', e.target.value)} placeholder="Optional feedback for this criterion" /></div></div>)}</div>
          <div className="mt-4 rounded-xl bg-paper p-4"><label className="label">Overall feedback to the student</label><textarea className="field min-h-24" value={finalFeedback} onChange={(e) => setFinalFeedback(e.target.value)} placeholder="Share one or two helpful observations and next steps…" /></div>
          {submission.ai_feedback && <details className="mt-4 rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-bold text-slate-600">View original AI feedback and uncertainty notes</summary><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-500">{submission.ai_feedback}</p></details>}
          <div className="mt-5 flex flex-col gap-3"><button type="submit" className="btn-primary w-full py-3" disabled={saving || totalScore > totalMax}><Save size={17} /> {saving ? 'Saving final assessment…' : 'Save final teacher assessment'}</button><p className="flex items-start gap-2 text-xs leading-5 text-slate-600"><CheckCircle2 size={15} className="mt-0.5 shrink-0" />Saving records the teacher-approved marks and feedback. AI suggestions are not treated as final until you save.</p></div>
        </section>
      </form>
    </section>
  </div>;
}