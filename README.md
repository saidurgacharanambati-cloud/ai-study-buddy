# 🎓 AI Study Buddy

An AI-powered technical learning assistant for Computer Science students. Built for the **NIAT GRIT Technical Interview** using **HTML5, Vanilla CSS, Vanilla JavaScript, Node.js, Express.js**, and the **Google Gemini API**.

---

## 🌟 Key Features

1. **Targeted Topic Learning**: Enter any technical topic (e.g. *Binary Search Trees*, *Operating System Deadlocks*, *REST APIs*, *SQL vs NoSQL*, *Dynamic Programming*).
2. **Three Specialized Learning Modes**:
   - 📝 **Study Notes**: Generates a structured breakdown with conceptual overview, core definitions, practical code snippets, common pitfalls, and quick exam takeaways.
   - 🎯 **MCQ Quiz**: Interactive 5-question multiple choice quiz with instant visual feedback (green/red), real-time score tracker, and in-depth explanations for every answer.
   - 💼 **Interview Prep**: Real-world technical interview questions with difficulty indicators, question types, and expandable model answers + interviewer evaluation criteria.
3. **Three Difficulty Levels**:
   - 🟢 **Beginner**: Conceptual clarity, intuitive analogies, foundational definitions.
   - 🟡 **Intermediate**: Implementation details, tradeoffs, edge cases.
   - 🔴 **Advanced**: Architectural patterns, scalability, system bottlenecks, internals.
4. **Security First**:
   - Gemini API keys are strictly kept on the backend using `dotenv` and `process.env`.
   - Never exposed in frontend JavaScript or committed to version control (`.gitignore` included).
5. **Zero-Framework Frontend**: Fast, lightweight vanilla HTML/CSS/JavaScript with responsive layout, glassmorphic dark theme, loading states, and full input validation.
6. **Deployment Ready**: Fully configured for local development and one-click **Vercel** serverless deployment.

---

## 🏗️ Project Architecture

```
ai-study-buddy/
├── public/                  # Frontend static files (Served by Express)
│   ├── index.html           # Semantic HTML5 layout, accessible controls, status badge
│   ├── style.css            # Responsive dark-theme design system with micro-animations
│   └── app.js               # Vanilla JS client: validation, API requests, dynamic UI rendering
├── server.js                # Express backend: validation, prompt construction, Gemini SDK call
├── api/
│   └── index.js             # Vercel serverless entry point (exports Express app)
├── vercel.json              # Vercel rewrite configuration for serverless functions & static assets
├── .env.example             # Template for required environment variables
├── .gitignore               # Protects sensitive files (.env) and node_modules from git
├── package.json             # Project dependencies and startup scripts
└── README.md                # Documentation and interview guide
```

---

## 🔄 Request Lifecycle (Frontend → Backend → Gemini → Frontend)

In your interview, explain the flow of data using these 6 clean steps:

```
[Student in Browser]
       │
       ▼  (1) Enters topic & clicks "Generate"
[public/app.js]
       │  - Validates input (length >= 2, non-empty)
       │  - Activates loading state & spinner
       ▼  (2) Sends HTTP POST /api/generate with { topic, mode, difficulty }
[server.js (Express)]
       │  - Validates request body & constraints
       │  - Reads GEMINI_API_KEY securely from process.env
       │  - Constructs difficulty-tailored prompt with strict JSON schema
       ▼  (3) Calls Google Gen AI SDK (@google/genai)
[Google Gemini API (gemini-3.5-flash)]
       │  - Generates structured JSON response
       ▼  (4) Returns response to Express backend
[server.js (Express)]
       │  - Parses & cleans JSON (handles markdown code fence stripping)
       ▼  (5) Sends JSON response { success: true, data: {...} } back to browser
[public/app.js]
       │  - Hides loading spinner
       ▼  (6) Dynamically renders UI cards, quiz buttons, or interview accordions
[Student Studies & Interacts with Feedback!]
```

---

## ⚙️ How to Configure Your Gemini API Key

> **Important**: Never commit your actual API key to GitHub.

1. **Get an API Key**:
   - Visit [Google AI Studio](https://aistudio.google.com/app/apikey).
   - Sign in with your Google account.
   - Click **Create API Key** and copy the generated key.

2. **Create your `.env` file**:
   In the root directory of this project, make a copy of `.env.example` named `.env`:

   **On Windows (PowerShell):**
   ```powershell
   Copy-Item .env.example .env
   ```

   **On macOS/Linux:**
   ```bash
   cp .env.example .env
   ```

3. **Paste your key into `.env`**:
   Open `.env` in your editor and update the line:
   ```env
   GEMINI_API_KEY=AIzaSyYourActualKeyGoesHere
   PORT=3000
   ```

---

## 🚀 How to Run the Application Locally

### 1. Install Dependencies
Open your terminal in the project folder and run:
```bash
npm install
```

### 2. Start the Server
For standard startup:
```bash
npm start
```
Or for development with automatic reload on file changes (Node 18+):
```bash
npm run dev
```

### 3. Open in Browser
Open your browser and navigate to:
```
http://localhost:3000
```
- The status indicator in the top-right header will display **"Gemini Ready"** with a glowing green dot if your key is configured properly.

---

## ☁️ Deploying to Vercel

This repository is already configured for zero-friction Vercel deployment:

1. Push your repository to GitHub (ensure `.env` is ignored by `.gitignore`).
2. Go to [Vercel](https://vercel.com/) and click **Add New Project**.
3. Import your `ai-study-buddy` repository.
4. In the **Environment Variables** section:
   - Key: `GEMINI_API_KEY`
   - Value: `<your-gemini-api-key>`
5. Click **Deploy**.
6. Vercel automatically routes `/api/*` to `api/index.js` as a serverless function and serves your static frontend assets directly.

---

## 🎤 Interview Questions & Preparation Guide (NIAT GRIT)

As a second-year CSE student, here are common questions interviewers may ask and how to answer them:

### Q1: Why did you choose Vanilla JS instead of a framework like React?
> **Answer**: *"For this application, I prioritized minimalism, zero build-step overhead, and fast initial load times. Vanilla JavaScript allows direct DOM manipulation without the virtual DOM overhead or heavy bundle size of React. It also demonstrates a strong grasp of core JavaScript fundamentals—DOM APIs, event delegation, async/await, and Fetch API—which are essential foundations for any web developer."*

### Q2: How did you ensure API keys are kept secure?
> **Answer**: *"If an API key is stored in frontend JavaScript, any user can inspect the source code or network tab and steal the key. To prevent this, I adopted a classic client-server separation: the frontend sends requests to my own Express backend (`/api/generate`), and the backend reads the key from `process.env` using `dotenv`. The key never leaves the server."*

### Q3: How do you handle unpredictable AI output from LLMs?
> **Answer**: *"LLMs can occasionally return markdown wrappers or slight formatting variations. I solved this in two ways: First, in the prompt engineering layer, I specified a rigid JSON schema and utilized Gemini's `responseMimeType: 'application/json'`. Second, in `server.js`, I wrote `cleanAndParseJson()` which strips markdown code fences if present, extracts the JSON object, and has a safe fallback that renders raw text cleanly so the client application never crashes."*

### Q4: Why did you choose Google Gemini (`gemini-3.5-flash` / `gemini-flash-latest`)?
> **Answer**: *"The `gemini-3.5-flash` model offers an optimal balance between low latency, cost-effectiveness, and reasoning capability. In an educational web app, speed is critical so students aren't kept waiting for notes or quiz evaluation. The flash family of models delivers near-instant structured JSON responses while maintaining high accuracy on technical CS topics."*

---

## 📜 Tech Stack Summary
- **Frontend**: HTML5, Vanilla CSS3 (Custom Properties & Flexbox/Grid), Vanilla JavaScript (ES6+).
- **Backend**: Node.js, Express.js.
- **AI SDK**: `@google/genai` (Official Google Gen AI SDK).
- **Model**: Google Gemini `gemini-3.5-flash` (with `gemini-flash-latest` and `gemini-3.5-flash-lite` fallbacks).
