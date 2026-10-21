import 'dotenv/config';
import Groq from 'groq-sdk';
import { httpError } from '../utils.js';

// Groq credentials remain server-side; never expose them to the browser.
let groqClient;
function getGroqClient() {
  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.startsWith('put-your-')) {
    throw httpError(503, 'AI review is not configured yet. Add GROQ_API_KEY in server/.env.');
  }
  if (!groqClient) groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return groqClient;
}

const modelName = () => process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b';
const safeString = (value, fallback = '') => typeof value === 'string' ? value.trim() : fallback;

function cleanModelJson(value) {
  const withoutThinkBlocks = value
    .replace(/<think\b[^>]*>[\s\S]*?<\/think\s*>/gi, '')
    .replace(/<think\b[^>]*>[\s\S]*$/gi, '')
    .trim();
  return withoutThinkBlocks.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

async function requestJson(messages, maxTokens = 3000) {
  try {
    const result = await getGroqClient().chat.completions.create({
      model: modelName(),
      temperature: 0.1,
      reasoning_effort: 'none',
      max_completion_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages,
    });
    const responseText = result.choices?.[0]?.message?.content;
    if (!responseText) throw new Error('The AI provider returned an empty result.');
    return JSON.parse(cleanModelJson(responseText));
  } catch (error) {
    console.error('Groq handwriting review failed:', error.message);
    if (error.status === 429) throw httpError(429, 'The AI service is busy or its rate limit was reached. Please try again later.');
    if (error.status === 401 || error.status === 403) throw httpError(503, 'Groq rejected the API credentials. Check GROQ_API_KEY in server/.env.');
    if (error.status) throw httpError(502, 'The AI service could not complete the review. Please retry.');
    if (error.statusCode) throw error;
    throw httpError(502, 'The AI response could not be read. Please retry, or ask a teacher to transcribe the page manually.');
  }
}

function rubricPromptShape(rubric) {
  return {
    name: rubric.name,
    description: rubric.description,
    totalMarks: Number(rubric.total_marks ?? rubric.totalMarks),
    criteria: Array.isArray(rubric.criteria) ? rubric.criteria : [],
  };
}

// First pass: transcribe only. Keeping transcription separate avoids grading
// based on words that the model may have misread in Hindi or Marathi.
export async function transcribeHandwriting({ imageBytes, mimeType }) {
  const imageDataUrl = `data:${mimeType};base64,${imageBytes.toString('base64')}`;
  const prompt = `Transcribe the attached photograph of a student's handwritten book summary. The writing may be in Hindi (Devanagari), Marathi (Devanagari), English, or a mixture. The photo may be tilted, shadowed, low-contrast, or the handwriting may be messy.

Transcription rules:
- Preserve the original language, script, spelling, punctuation, line breaks, and meaning as closely as possible. Do not translate or summarize.
- Read Devanagari carefully; Hindi and Marathi share a script, so do not guess the language from script alone.
- Do not autocorrect a word into a more plausible word if the visible letters do not support it.
- Use [unclear] only for genuinely unreadable words; do not fill gaps from context or invent missing sentences.
- If only part of a word is legible, preserve the legible part and mark the uncertain part as [unclear].
- Do not grade the work and do not provide feedback.

Return valid JSON only with exactly these keys: {"extractedText":"faithful transcription","detectedLanguage":"Hindi, Marathi, English, mixed, or uncertain","uncertaintyNotes":"brief notes about genuinely unclear areas"}.`;
  const parsed = await requestJson([
    { role: 'system', content: 'You are a careful OCR assistant specializing in handwritten Hindi and Marathi in Devanagari script, as well as English. Accuracy and uncertainty are more important than fluency.' },
    { role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: imageDataUrl } }] },
  ], 3000);
  return {
    extractedText: safeString(parsed.extractedText),
    detectedLanguage: safeString(parsed.detectedLanguage, 'uncertain'),
    uncertaintyNotes: safeString(parsed.uncertaintyNotes).slice(0, 2000),
    model: modelName(),
  };
}

// Second pass: evaluate the teacher-corrected transcription, not the image OCR.
export async function gradeTranscription({ extractedText, rubric, studentName }) {
  const text = safeString(extractedText);
  if (!text) throw httpError(400, 'Transcribe or correct the student text before asking AI to suggest marks.');
  if (text.length > 30000) throw httpError(400, 'The corrected transcription is too long.');
  const rubricForPrompt = rubricPromptShape(rubric);
  const prompt = `Suggest marks for a student's handwritten book summary using ONLY the teacher's rubric. The transcription below has been reviewed/corrected by a teacher and must be treated as the source text. Do not try to reconstruct the original handwriting.

Student label (context only): ${studentName || 'Student'}
Teacher rubric (JSON): ${JSON.stringify(rubricForPrompt)}
Teacher-verified transcription (keep language as written):\n---\n${text}\n---

Return JSON with exactly these keys: {"criteria":[{"name":"exact rubric criterion name","marks":0,"maxMarks":0,"evidence":"short quote or evidence from the transcription","feedback":"short constructive note"}],"overallFeedback":"kind, specific feedback","uncertaintyNotes":"any limitations in judging from transcription alone"}.

Rules:
- Return one item for every rubric criterion, in the rubric's order, using each exact criterion name.
- Evaluate only content present in the provided transcription. Do not assume or add missing content.
- Evidence should quote or refer to the provided text, not imagined visual details.
- Respect each criterion's maximum marks. Use conservative marks when evidence is insufficient.
- Do not assess handwriting, spelling, visual layout, or neatness from a transcription; those cannot be reliably judged here.
- This is a suggestion, not a final grade. Feedback must be respectful and age-appropriate.
- Output valid JSON only.`;
  const parsed = await requestJson([
    { role: 'system', content: 'You are a fair educational assessor. Apply the supplied rubric to the supplied teacher-verified text. Never invent evidence.' },
    { role: 'user', content: prompt },
  ], 3000);
  const expectedCriteria = rubricForPrompt.criteria;
  const returnedCriteria = Array.isArray(parsed.criteria) ? parsed.criteria : [];
  const criteria = expectedCriteria.map((criterion, index) => {
    const suggested = returnedCriteria.find((item) => safeString(item?.name) === safeString(criterion.name)) || returnedCriteria[index] || null;
    const maxMarks = Number(criterion.maxMarks ?? criterion.max_marks ?? 0);
    const rawMarks = Number(suggested?.marks);
    const marks = Number.isFinite(rawMarks) ? Math.max(0, Math.min(maxMarks, rawMarks)) : 0;
    return {
      name: criterion.name,
      maxMarks,
      marks: Math.round(marks * 100) / 100,
      evidence: safeString(suggested?.evidence, 'No clear evidence was returned.').slice(0, 1200),
      feedback: safeString(suggested?.feedback).slice(0, 1200),
    };
  });
  const totalScore = Math.round(criteria.reduce((sum, criterion) => sum + criterion.marks, 0) * 100) / 100;
  return {
    criteria,
    totalScore,
    overallFeedback: safeString(parsed.overallFeedback).slice(0, 4000),
    uncertaintyNotes: safeString(parsed.uncertaintyNotes).slice(0, 2000),
    model: modelName(),
  };
}

// Kept for compatibility with any existing callers of the original endpoint.
export async function evaluateHandwriting({ imageBytes, mimeType, rubric, studentName }) {
  const transcription = await transcribeHandwriting({ imageBytes, mimeType });
  const assessment = await gradeTranscription({ extractedText: transcription.extractedText, rubric, studentName });
  return { ...transcription, ...assessment };
}