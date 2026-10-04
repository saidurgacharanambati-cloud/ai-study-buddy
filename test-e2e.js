/**
 * Automated Verification & Test Script for AI Study Buddy
 * -------------------------------------------------------------
 * Tests:
 * 1. Health check endpoint (/api/health)
 * 2. Static file serving (HTML, CSS, JS)
 * 3. Backend input validation (topic length, invalid modes, invalid difficulty)
 * 4. Live Gemini API generation (Study Notes generation with real AI output)
 * 
 * Usage: npm test (or node test-e2e.js)
 */

require('dotenv').config();
const app = require('./server');

const TEST_PORT = 3456;
const BASE_URL = `http://localhost:${TEST_PORT}`;

let passedCount = 0;
let totalTests = 0;

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`❌ FAIL: ${testName}`);
  }
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, options);
  let data;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }
  return { status: response.status, headers: response.headers, data };
}

async function runTests() {
  console.log(`\n========================================`);
  console.log(`🧪 Running AI Study Buddy Automated Tests`);
  console.log(`========================================\n`);

  const server = app.listen(TEST_PORT, async () => {
    try {
      // Test 1: Health Check Endpoint
      const health = await request('/api/health');
      assert(health.status === 200, 'GET /api/health returns 200 OK');
      assert(health.data.status === 'ok', 'Health status field is "ok"');
      assert(health.data.hasApiKey === true, 'Health check confirms GEMINI_API_KEY is present');
      assert(Array.isArray(health.data.supportedModes), 'Health lists supportedModes array');
      assert(health.data.supportedModes.includes('notes'), 'supportedModes includes "notes"');
      assert(health.data.supportedModes.includes('quiz'), 'supportedModes includes "quiz"');
      assert(health.data.supportedModes.includes('interview'), 'supportedModes includes "interview"');

      // Test 2: Static Files
      const indexHtml = await request('/');
      assert(indexHtml.status === 200, 'GET / serves index.html with 200');
      assert(indexHtml.data.includes('<title>AI Study Buddy'), 'index.html contains app title');
      assert(indexHtml.data.includes('id="studyForm"'), 'index.html contains study form');

      const css = await request('/style.css');
      assert(css.status === 200, 'GET /style.css returns 200');
      assert(css.data.includes('--bg-primary'), 'style.css contains design system variables');

      const js = await request('/app.js');
      assert(js.status === 200, 'GET /app.js returns 200');
      assert(js.data.includes('checkServerHealth'), 'app.js contains health check logic');

      // Test 3: Validation - Empty Topic
      const emptyTopic = await request('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: '', mode: 'notes', difficulty: 'beginner' })
      });
      assert(emptyTopic.status === 400, 'Empty topic returns 400 Bad Request');
      assert(emptyTopic.data.error.includes('valid topic'), 'Error message specifies topic is needed');

      // Test 4: Validation - Too Short Topic
      const shortTopic = await request('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: 'a', mode: 'notes', difficulty: 'beginner' })
      });
      assert(shortTopic.status === 400, 'Single character topic returns 400 Bad Request');

      // Test 5: Validation - Invalid Mode
      const invalidMode = await request('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: 'Deadlocks', mode: 'hologram', difficulty: 'beginner' })
      });
      assert(invalidMode.status === 400, 'Invalid mode returns 400 Bad Request');
      assert(invalidMode.data.error.includes('Invalid study mode'), 'Error message lists valid modes');

      // Test 6: Validation - Invalid Difficulty
      const invalidDiff = await request('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: 'Deadlocks', mode: 'notes', difficulty: 'expert-level' })
      });
      assert(invalidDiff.status === 400, 'Invalid difficulty returns 400 Bad Request');

      // Test 7: Live Gemini Generation - Study Notes
      console.log('\n[E2E] Testing live Study Notes generation...');
      const notesGen = await request('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: 'Binary Search Trees', mode: 'notes', difficulty: 'beginner' })
      });
      assert(notesGen.status === 200, 'POST /api/generate (Notes) returns 200 OK');
      assert(notesGen.data.success === true, 'Notes response has success: true');
      assert(Boolean(notesGen.data.data && notesGen.data.data.overview), 'Notes contains structured overview');
      assert(!JSON.stringify(notesGen.data).includes(process.env.GEMINI_API_KEY), 'Notes response does NOT expose GEMINI_API_KEY');

      // Test 8: Live Gemini Generation - MCQ Quiz
      console.log('\n[E2E] Testing live MCQ Quiz generation...');
      const quizGen = await request('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: 'OS Deadlocks', mode: 'quiz', difficulty: 'intermediate' })
      });
      assert(quizGen.status === 200, 'POST /api/generate (Quiz) returns 200 OK');
      assert(quizGen.data.success === true, 'Quiz response has success: true');
      assert(Array.isArray(quizGen.data.data.questions), 'Quiz response contains questions array');
      assert(quizGen.data.data.questions.length > 0, 'Quiz questions array is not empty');
      assert(!JSON.stringify(quizGen.data).includes(process.env.GEMINI_API_KEY), 'Quiz response does NOT expose GEMINI_API_KEY');

      // Test 9: Live Gemini Generation - Interview Preparation
      console.log('\n[E2E] Testing live Interview Preparation generation...');
      const interviewGen = await request('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: 'RESTful API Design', mode: 'interview', difficulty: 'advanced' })
      });
      assert(interviewGen.status === 200, 'POST /api/generate (Interview) returns 200 OK');
      assert(interviewGen.data.success === true, 'Interview response has success: true');
      assert(Array.isArray(interviewGen.data.data.questions), 'Interview response contains questions array');
      assert(interviewGen.data.data.questions.length > 0, 'Interview questions array is not empty');
      assert(!JSON.stringify(interviewGen.data).includes(process.env.GEMINI_API_KEY), 'Interview response does NOT expose GEMINI_API_KEY');

      console.log(`\n========================================`);
      console.log(`📊 Test Summary: ${passedCount}/${totalTests} Passed`);
      console.log(`========================================\n`);

      if (passedCount === totalTests) {
        console.log('🎉 All automated tests passed successfully!');
        server.close(() => process.exit(0));
      } else {
        console.error('⚠️ Some tests failed.');
        server.close(() => process.exit(1));
      }

    } catch (err) {
      console.error('Fatal test error:', err);
      server.close(() => process.exit(1));
    }
  });
}

runTests();
