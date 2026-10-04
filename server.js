/**
 * AI Study Buddy - Backend Server
 * -------------------------------------------------------------
 * Built with Node.js and Express.js
 * Uses the official Google Gen AI SDK (@google/genai)
 * 
 * Features:
 * 1. Serves static frontend files (HTML/CSS/JS)
 * 2. Provides /api/health to check server & API key status
 * 3. Provides /api/generate to generate Study Notes, Quizzes, and Interview Prep
 * 4. Architecture compatible with both local development and Vercel serverless deployment
 */

const express = require('express');
const path = require('path');
require('dotenv').config();

// Initialize the official Google Gen AI SDK
const { GoogleGenAI } = require('@google/genai');

const app = express();

// Middlewares
app.use(express.json({ limit: '1mb' }));
// Serve frontend static assets from public/ folder
app.use(express.static(path.join(__dirname, 'public')));

// Helper to get configured Gemini API key
function getApiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
}

/**
 * Build a structured prompt based on user's selected mode and difficulty.
 * Requesting JSON output ensures clean, reliable UI rendering on the frontend.
 */
function buildPrompt(topic, mode, difficulty) {
  const difficultyGuides = {
    beginner: 'Keep explanations simple, intuitive, jargon-free, using everyday analogies and foundational definitions.',
    intermediate: 'Include technical depth, practical code/implementation details, tradeoffs, and common edge cases.',
    advanced: 'Cover architectural design, performance bottlenecks, optimization, internal mechanics, and high-scale considerations.'
  };

  const difficultyInstruction = difficultyGuides[difficulty] || difficultyGuides.intermediate;

  if (mode === 'notes') {
    return `
You are an expert Computer Science professor and tutor.
Generate comprehensive, highly structured Study Notes on the topic: "${topic}".
Target Difficulty: "${difficulty.toUpperCase()}".
Guidance: ${difficultyInstruction}

You MUST return your response as a valid JSON object matching this exact structure:
{
  "mode": "notes",
  "topic": "${topic}",
  "difficulty": "${difficulty}",
  "overview": "A clear 2-3 sentence overview and mental model of the concept.",
  "keyConcepts": [
    {
      "title": "Concept 1 Name",
      "explanation": "Clear explanation of this concept."
    },
    {
      "title": "Concept 2 Name",
      "explanation": "Clear explanation of this concept."
    },
    {
      "title": "Concept 3 Name",
      "explanation": "Clear explanation of this concept."
    }
  ],
  "codeOrExample": "Practical code snippet (with comments) or concrete step-by-step example illustrating the concept.",
  "commonPitfalls": [
    "Pitfall or common mistake 1",
    "Pitfall or common mistake 2"
  ],
  "quickSummary": "Concise 2-sentence summary for quick exam/interview revision."
}
Return only valid JSON. Do not include markdown code block backticks if possible.
`;
  }

  if (mode === 'quiz') {
    return `
You are an expert technical examiner.
Generate a 5-question Multiple Choice Quiz (MCQ) to test understanding of: "${topic}".
Target Difficulty: "${difficulty.toUpperCase()}".
Guidance: ${difficultyInstruction}

You MUST return your response as a valid JSON object matching this exact structure:
{
  "mode": "quiz",
  "topic": "${topic}",
  "difficulty": "${difficulty}",
  "questions": [
    {
      "id": 1,
      "question": "Question text here?",
      "options": [
        "First option",
        "Second option",
        "Third option",
        "Fourth option"
      ],
      "correctIndex": 0,
      "explanation": "Clear explanation of why this option is correct and why other options are incorrect."
    }
  ]
}
Generate exactly 5 questions. Make sure correctIndex is an integer from 0 to 3 corresponding to the correct option in the options array.
Return only valid JSON. Do not include markdown code block backticks if possible.
`;
  }

  if (mode === 'interview') {
    return `
You are a senior technical interviewer at a top tech company.
Generate 4 realistic interview questions to evaluate a candidate on: "${topic}".
Target Difficulty: "${difficulty.toUpperCase()}".
Guidance: ${difficultyInstruction}

You MUST return your response as a valid JSON object matching this exact structure:
{
  "mode": "interview",
  "topic": "${topic}",
  "difficulty": "${difficulty}",
  "questions": [
    {
      "id": 1,
      "question": "Interview question text here?",
      "questionType": "Conceptual | Problem Solving | System Design",
      "idealAnswer": "Comprehensive, structured model answer showing how a strong candidate responds.",
      "keyPoints": [
        "Key evaluation point 1",
        "Key evaluation point 2"
      ],
      "followUp": "A common follow-up question the interviewer might ask next."
    }
  ]
}
Generate exactly 4 questions.
Return only valid JSON. Do not include markdown code block backticks if possible.
`;
  }

  throw new Error(`Invalid mode specified: ${mode}`);
}

/**
 * Safely parse JSON from Gemini's response, stripping any markdown formatting if present.
 */
function cleanAndParseJson(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Empty response received from Gemini.');
  }

  // Remove markdown code fences like ```json ... ``` or ``` ... ```
  let cleaned = rawText.trim();
  cleaned = cleaned.replace(/^```json\s*/i, '');
  cleaned = cleaned.replace(/^```\s*/, '');
  cleaned = cleaned.replace(/\s*```$/, '');
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch (parseError) {
    // If exact parsing fails, try to extract first JSON object substring
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw parseError;
  }
}

/**
 * Safely extract error status and message without exposing API keys or secrets
 */
function extractSafeErrorInfo(err) {
  let status = err.status || (err.response && err.response.status) || 500;
  let message = err.message || String(err);

  try {
    const parsed = JSON.parse(err.message);
    if (parsed.error) {
      status = parsed.error.code || status;
      message = parsed.error.message || message;
    }
  } catch (_) {
    // message is already plain text
  }

  // Redact potential API keys or token strings from logs
  const sanitizedMessage = String(message)
    .replace(/(?:key[=:]\s*|AIza|AQ\.)[A-Za-z0-9_\-]+/gi, '[REDACTED_API_KEY]');

  return { status, message: sanitizedMessage };
}

/**
 * Call Gemini API using @google/genai with supported model fallbacks
 */
async function callGemini(apiKey, prompt) {
  const ai = new GoogleGenAI({ apiKey });
  
  // Currently active models supported by the Gemini Developer API
  const modelsToTry = [
    'gemini-3.5-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash'
  ];

  let lastError = null;

  for (const model of modelsToTry) {
    try {
      console.log(`[Gemini SDK] Requesting content with model: ${model}...`);
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.7,
        }
      });

      if (response && response.text) {
        console.log(`[Gemini SDK] Generation successful using model: ${model}`);
        return { text: response.text, modelUsed: model };
      }
    } catch (err) {
      lastError = err;
      const safeError = extractSafeErrorInfo(err);
      console.warn(`[Gemini SDK] Model '${model}' failed with status ${safeError.status}: ${safeError.message}`);
    }
  }

  throw lastError || new Error('Failed to generate response from Gemini API.');
}

// ---------------------- ROUTES ----------------------

/**
 * Health check route:
 * Allows frontend or tests to verify server status and whether an API key is configured.
 */
app.get('/api/health', (req, res) => {
  const apiKey = getApiKey();
  res.json({
    status: 'ok',
    hasApiKey: Boolean(apiKey),
    primaryModel: 'gemini-3.5-flash',
    supportedModes: ['notes', 'quiz', 'interview'],
    supportedDifficulties: ['beginner', 'intermediate', 'advanced']
  });
});

/**
 * Generation route:
 * Receives { topic, mode, difficulty } from frontend
 * Validates input, builds prompt, calls Gemini API, returns parsed JSON
 */
app.post('/api/generate', async (req, res) => {
  try {
    const { topic, mode, difficulty } = req.body || {};

    // 1. Validate Input
    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid topic to study.'
      });
    }

    const trimmedTopic = topic.trim();
    if (trimmedTopic.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Topic must be at least 2 characters long.'
      });
    }

    if (trimmedTopic.length > 120) {
      return res.status(400).json({
        success: false,
        error: 'Topic is too long. Please keep it under 120 characters.'
      });
    }

    const validModes = ['notes', 'quiz', 'interview'];
    if (!mode || !validModes.includes(mode)) {
      return res.status(400).json({
        success: false,
        error: `Invalid study mode. Must be one of: ${validModes.join(', ')}.`
      });
    }

    const validDifficulties = ['beginner', 'intermediate', 'advanced'];
    if (!difficulty || !validDifficulties.includes(difficulty)) {
      return res.status(400).json({
        success: false,
        error: `Invalid difficulty. Must be one of: ${validDifficulties.join(', ')}.`
      });
    }

    // 2. Validate API Key
    const apiKey = getApiKey();
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'GEMINI_API_KEY is not configured on the server. Please add GEMINI_API_KEY to your .env file or hosting environment variables.'
      });
    }

    // 3. Construct prompt
    const prompt = buildPrompt(trimmedTopic, mode, difficulty);

    // 4. Call Gemini
    const { text, modelUsed } = await callGemini(apiKey, prompt);

    // 5. Clean & Parse JSON
    try {
      const parsedData = cleanAndParseJson(text);
      return res.json({
        success: true,
        model: modelUsed,
        data: parsedData
      });
    } catch (parseErr) {
      console.error('[JSON Parser] Failed to parse Gemini output as JSON:', parseErr.message);
      // Fallback: Return raw text cleanly if JSON parsing fails
      return res.json({
        success: true,
        model: modelUsed,
        data: {
          mode,
          topic: trimmedTopic,
          difficulty,
          isRawText: true,
          rawContent: text
        }
      });
    }

  } catch (error) {
    const safeError = extractSafeErrorInfo(error);
    console.error(`[Generate API Error] Status ${safeError.status}: ${safeError.message}`);

    // Provide friendly, actionable error messages to the client
    let clientMessage = 'Failed to generate study materials. Please try again.';

    if (safeError.status === 404) {
      clientMessage = 'The selected AI model was not found or is no longer available. Please check server model configuration.';
    } else if (safeError.status === 503 || safeError.status === 429 || safeError.message.includes('high demand') || safeError.message.includes('quota')) {
      clientMessage = 'Gemini API is currently experiencing temporary high traffic or rate limits. Please try again in a moment.';
    } else if (safeError.message.includes('API_KEY_INVALID') || safeError.message.includes('API key not valid')) {
      clientMessage = 'Your Gemini API key appears to be invalid. Please verify the key in your .env file.';
    }

    return res.status(500).json({
      success: false,
      error: clientMessage,
      status: safeError.status
    });
  }
});

// Fallback for SPA routing - serves index.html for unmatched routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start local HTTP server only when run directly (e.g. `node server.js`)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  const server = app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🎓 AI Study Buddy server started successfully!`);
    console.log(`🌐 Local URL: http://localhost:${PORT}`);
    console.log(`🔑 API Key configured: ${Boolean(getApiKey()) ? 'YES' : 'NO (Add to .env)'}`);
    console.log(`===============================================`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Error: Port ${PORT} is already in use by another process.`);
      console.error(`👉 Solutions:`);
      console.error(`   1. Free port ${PORT}, or`);
      console.error(`   2. Set a different port in .env (e.g. PORT=3001), or`);
      console.error(`   3. Run with: $env:PORT=3001; npm start\n`);
    } else {
      console.error('Server error:', err);
    }
    process.exit(1);
  });
}

// Export app for Vercel serverless deployment
module.exports = app;

