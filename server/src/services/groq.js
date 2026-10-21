import 'dotenv/config';
import Groq from 'groq-sdk';
import { httpError } from '../utils.js';

// Groq is the only AI provider used by this version. The API key stays on the
// backend; it is never sent to React or included in an API response.
let groqClient;
function getGroqClient() {
  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.startsWith('put-your-')) {
    throw httpError(503, 'AI review is not configured yet. Add GROQ_API_KEY in server/.env.');
  }
  if (!groqClient) groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return groqClient;
}

function safeString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

// Ask the vision model to read the handwritten page and grade it against a
// teacher-defined rubric. The model's total is recalculated by the server below.
export async function evaluateHandwriting({ imageBytes, mimeType, rubric, studentName }) {
  const client = getGroqClient();
  const imageDataUrl = `data:${mimeType};base64,${imageBytes.toString('base64')}`;
  const rubricForPrompt = {
    name: rubric.name,
    description: rubric.description,
    totalMarks: Number(rubric.total_marks ?? rubric.totalMarks),
    criteria: Array.isArray(rubric.criteria) ? rubric.criteria : [],
  };

  const prompt = `Review the attached handwritten student book summary. It may be written in Hindi, Marathi, English, or a mix. Read the page faithfully; if a word is unclear, mark it as [unclear] instead of inventing it. Then provide a suggested evaluation using only the teacher's rubric below.

Student label (for context only): ${studentName || 'Student'}
Teacher rubric (JSON): ${JSON.stringify(rubricForPrompt)}

Return a JSON object with exactly these keys:
{
  "extractedText": "faithful transcription in the original language/script",
  "detectedLanguage": "Hindi, Marathi, English, mixed, or uncertain",
  "criteria": [{"name":"exact rubric criterion name","marks":0,"maxMarks":0,"evidence":"short evidence from the page","feedback":"short constructive note"}],
  "overallFeedback": "kind, specific feedback for the student",
  "uncertaintyNotes": "any handwriting/transcription uncertainty"
}

Rules:
- Include one criteria item for every rubric criterion, preserving the rubric order and exact names.
- Every marks value must be between zero and that criterion's maxMarks.
- Use the original-language writing for extractedText where possible; do not translate it unless the page itself does so.
- Do not reward content that is not visible in the submission. Do not infer the student's ability or identity.
- The result is a suggestion, not a final grade. Keep feedback age-appropriate and respectful.
- Output valid JSON only, with no Markdown code fences.`;

  try {
    const result = await client.chat.completions.create({
      model: process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b',
      temperature: 0.2,
      reasoning_effort: 'none',
      max_completion_tokens: 3000,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a careful multilingual handwriting reader and rubric-based educational assessment assistant. Follow the requested JSON schema exactly.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageDataUrl } },
          ],
        },
      ],
    });

    const responseText = result.choices?.[0]?.message?.content;
    if (!responseText) throw new Error('The AI provider returned an empty result.');
    const parsed = JSON.parse(responseText);
    const expectedCriteria = rubricForPrompt.criteria;

    // Trust the teacher's marks/maxima, not values invented by the model.
    const criteria = expectedCriteria.map((criterion, index) => {
      const suggested = Array.isArray(parsed.criteria) ? parsed.criteria[index] : null;
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

    const totalScore = criteria.reduce((sum, criterion) => sum + criterion.marks, 0);
    return {
      extractedText: safeString(parsed.extractedText),
      detectedLanguage: safeString(parsed.detectedLanguage, 'uncertain'),
      criteria,
      totalScore: Math.round(totalScore * 100) / 100,
      overallFeedback: safeString(parsed.overallFeedback).slice(0, 4000),
      uncertaintyNotes: safeString(parsed.uncertaintyNotes).slice(0, 2000),
      model: process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b',
    };
  } catch (error) {
    // Avoid returning raw provider output or keys to the end user.
    console.error('Groq handwriting review failed:', error.message);
    if (error.status === 429) {
      throw httpError(429, 'The AI service is busy or its rate limit was reached. Please try again later.');
    }
    if (error.status === 401 || error.status === 403) {
      throw httpError(503, 'Groq rejected the API credentials. Check GROQ_API_KEY in server/.env.');
    }
    if (error.status) throw httpError(502, 'The AI service could not complete the review. Please retry.');
    throw httpError(502, 'The AI response could not be read. Please retry, or ask a teacher to transcribe the page manually.');
  }
}
