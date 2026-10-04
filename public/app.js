/**
 * AI Study Buddy - Frontend Client Logic
 * -------------------------------------------------------------
 * Built with Vanilla JavaScript (ES6+)
 * 
 * Flow:
 * 1. Initializes page & checks backend health via GET /api/health
 * 2. Manages form state: topic input, study mode, difficulty level
 * 3. Validates inputs before sending requests
 * 4. Dispatches POST /api/generate with JSON payload
 * 5. Handles loading, error, and dynamic content rendering:
 *    - Study Notes (structured concepts, code snippet, pitfalls, summary)
 *    - MCQ Quiz (interactive choices, instant feedback, live score tracker)
 *    - Interview Prep (expandable accordions, model answers, follow-up questions)
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Element References ---
  const studyForm = document.getElementById('studyForm');
  const topicInput = document.getElementById('topicInput');
  const clearTopicBtn = document.getElementById('clearTopicBtn');
  const charCount = document.getElementById('charCount');
  const topicError = document.getElementById('topicError');
  const generateBtn = document.getElementById('generateBtn');
  const btnText = document.getElementById('btnText');

  // Status badge elements
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');

  // View state containers
  const emptyState = document.getElementById('emptyState');
  const loadingState = document.getElementById('loadingState');
  const errorBanner = document.getElementById('errorBanner');
  const errorTitle = document.getElementById('errorTitle');
  const errorMessage = document.getElementById('errorMessage');
  const errorTips = document.getElementById('errorTips');
  const closeErrorBtn = document.getElementById('closeErrorBtn');
  const outputContainer = document.getElementById('outputContainer');

  // Loading indicator steps
  const step1 = document.getElementById('step1');
  const step2 = document.getElementById('step2');
  const step3 = document.getElementById('step3');
  let stepTimer = null;

  // Active Quiz State (for tracking score and answers in memory)
  let quizState = {
    questions: [],
    answeredCount: 0,
    score: 0
  };

  // --- Initial Setup & Health Check ---
  checkServerHealth();
  setupEventListeners();

  /**
   * Check backend health and API key readiness on load
   */
  async function checkServerHealth() {
    try {
      const response = await fetch('/api/health');
      if (!response.ok) throw new Error('Server returned non-200');
      const data = await response.json();

      if (data.hasApiKey) {
        statusDot.className = 'status-dot online';
        statusText.textContent = 'Gemini Ready';
      } else {
        statusDot.className = 'status-dot';
        statusText.textContent = 'Key Missing (.env)';
        showError(
          'Gemini API Key Missing',
          'The server is running, but no GEMINI_API_KEY was found in .env.',
          'Add GEMINI_API_KEY=your_key to your .env file and restart the server.'
        );
      }
    } catch (err) {
      statusDot.className = 'status-dot error';
      statusText.textContent = 'Server Offline';
      console.warn('Backend health check failed:', err);
    }
  }

  /**
   * Set up all UI event listeners
   */
  function setupEventListeners() {
    // Topic input character counter & clear button
    topicInput.addEventListener('input', () => {
      const length = topicInput.value.length;
      charCount.textContent = `${length}/120`;
      clearTopicBtn.hidden = length === 0;
      if (length > 0) {
        clearFieldError();
      }
    });

    // Clear topic input button
    clearTopicBtn.addEventListener('click', () => {
      topicInput.value = '';
      charCount.textContent = '0/120';
      clearTopicBtn.hidden = true;
      clearFieldError();
      topicInput.focus();
    });

    // Quick suggestion topic chips
    document.querySelectorAll('.topic-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const topic = chip.getAttribute('data-topic');
        topicInput.value = topic;
        charCount.textContent = `${topic.length}/120`;
        clearTopicBtn.hidden = false;
        clearFieldError();
        topicInput.focus();
      });
    });

    // Dismiss error banner
    closeErrorBtn.addEventListener('click', () => {
      errorBanner.hidden = true;
    });

    // Form submission
    studyForm.addEventListener('submit', handleFormSubmit);
  }

  /**
   * Handle form submission and trigger content generation
   */
  async function handleFormSubmit(e) {
    e.preventDefault();

    const topic = topicInput.value.trim();
    const mode = getSelectedRadioValue('mode');
    const difficulty = getSelectedRadioValue('difficulty');

    // 1. Client-Side Input Validation
    if (!topic) {
      showFieldError('Please enter a topic before generating.');
      topicInput.focus();
      return;
    }

    if (topic.length < 2) {
      showFieldError('Topic must be at least 2 characters long.');
      topicInput.focus();
      return;
    }

    clearFieldError();

    // 2. Transition UI to Loading State
    setLoadingState(true);

    try {
      // 3. Make HTTP POST request to Express backend
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          topic,
          mode,
          difficulty
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to generate study materials.');
      }

      // 4. Render output based on mode
      renderOutput(result.data, mode, difficulty);

    } catch (err) {
      console.error('Generation Error:', err);
      showError(
        'Generation Failed',
        err.message || 'An unexpected error occurred while communicating with Gemini.',
        'Ensure your GEMINI_API_KEY is active and valid, then try again.'
      );
    } finally {
      setLoadingState(false);
    }
  }

  /**
   * Manage Loading State in the UI
   */
  function setLoadingState(isLoading) {
    if (isLoading) {
      generateBtn.disabled = true;
      btnText.textContent = 'Generating with Gemini...';
      emptyState.hidden = true;
      errorBanner.hidden = true;
      outputContainer.hidden = true;
      loadingState.hidden = false;

      // Animate progress steps
      let currentStep = 1;
      step1.className = 'step-badge active';
      step2.className = 'step-badge';
      step3.className = 'step-badge';

      clearInterval(stepTimer);
      stepTimer = setInterval(() => {
        currentStep++;
        if (currentStep === 2) {
          step1.className = 'step-badge';
          step2.className = 'step-badge active';
        } else if (currentStep === 3) {
          step2.className = 'step-badge';
          step3.className = 'step-badge active';
        }
      }, 1500);

    } else {
      generateBtn.disabled = false;
      btnText.textContent = 'Generate Study Content';
      loadingState.hidden = true;
      clearInterval(stepTimer);
    }
  }

  /**
   * Display inline field validation error
   */
  function showFieldError(msg) {
    topicError.textContent = msg;
    topicInput.style.borderColor = 'var(--error)';
  }

  function clearFieldError() {
    topicError.textContent = '';
    topicInput.style.borderColor = '';
  }

  /**
   * Display top error banner with actionable advice
   */
  function showError(title, msg, tip = '') {
    errorTitle.textContent = title;
    errorMessage.textContent = msg;
    if (tip) {
      errorTips.textContent = `Tip: ${tip}`;
      errorTips.hidden = false;
    } else {
      errorTips.hidden = true;
    }
    errorBanner.hidden = false;
    errorBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /**
   * Read selected radio input value
   */
  function getSelectedRadioValue(name) {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    return checked ? checked.value : null;
  }

  /**
   * Main Router to delegate rendering based on mode
   */
  function renderOutput(data, mode, difficulty) {
    errorBanner.hidden = true;
    loadingState.hidden = true;
    emptyState.hidden = true;
    outputContainer.innerHTML = '';
    outputContainer.hidden = false;

    // Handle fallback if data came back as raw text
    if (data.isRawText) {
      renderRawContent(data);
      return;
    }

    if (mode === 'notes') {
      renderNotes(data, difficulty);
    } else if (mode === 'quiz') {
      renderQuiz(data, difficulty);
    } else if (mode === 'interview') {
      renderInterview(data, difficulty);
    } else {
      renderRawContent(data);
    }

    // Smooth scroll to output container
    outputContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ==========================================================================
  // Mode 1: Render Study Notes
  // ==========================================================================
  function renderNotes(data, difficulty) {
    const topic = data.topic || topicInput.value;
    const keyConcepts = Array.isArray(data.keyConcepts) ? data.keyConcepts : [];
    const pitfalls = Array.isArray(data.commonPitfalls) ? data.commonPitfalls : [];

    // Header with badges and Copy button
    const headerHtml = `
      <div class="content-card-header">
        <div class="content-topic-info">
          <h3 class="content-topic-title">${escapeHtml(topic)}</h3>
          <span class="tag-badge mode-notes">📝 Study Notes</span>
          <span class="tag-badge ${escapeHtml(difficulty)}">${escapeHtml(difficulty)}</span>
        </div>
        <div class="header-actions">
          <button type="button" class="secondary-btn" id="copyNotesBtn">
            <span>📋</span> <span id="copyBtnText">Copy Notes</span>
          </button>
        </div>
      </div>
    `;

    // Overview section
    const overviewHtml = `
      <div class="note-section-card">
        <h4 class="note-section-title">💡 Core Overview & Mental Model</h4>
        <p class="note-overview-text">${escapeHtml(data.overview || 'No overview provided.')}</p>
      </div>
    `;

    // Key Concepts section
    let conceptsHtml = '';
    if (keyConcepts.length > 0) {
      const conceptItems = keyConcepts.map(item => `
        <div class="concept-item">
          <h5>${escapeHtml(item.title || 'Concept')}</h5>
          <p>${escapeHtml(item.explanation || '')}</p>
        </div>
      `).join('');

      conceptsHtml = `
        <div class="note-section-card">
          <h4 class="note-section-title">🔑 Key Concepts</h4>
          <div class="concepts-grid">
            ${conceptItems}
          </div>
        </div>
      `;
    }

    // Code or Practical Example
    let codeHtml = '';
    if (data.codeOrExample) {
      codeHtml = `
        <div class="note-section-card">
          <h4 class="note-section-title">💻 Code / Practical Example</h4>
          <div class="code-box">
            <div class="code-box-header">
              <span>Example Implementation</span>
              <span>Code Snippet</span>
            </div>
            <pre><code>${escapeHtml(data.codeOrExample)}</code></pre>
          </div>
        </div>
      `;
    }

    // Common Pitfalls
    let pitfallsHtml = '';
    if (pitfalls.length > 0) {
      const pitfallItems = pitfalls.map(p => `<li>${escapeHtml(p)}</li>`).join('');
      pitfallsHtml = `
        <div class="note-section-card">
          <h4 class="note-section-title">⚠️ Common Mistakes & Pitfalls</h4>
          <ul class="pitfalls-list">
            ${pitfallItems}
          </ul>
        </div>
      `;
    }

    // Quick Revision Summary
    let summaryHtml = '';
    if (data.quickSummary) {
      summaryHtml = `
        <div class="note-section-card">
          <h4 class="note-section-title">📌 Quick Exam / Interview Takeaway</h4>
          <div class="summary-box">
            ${escapeHtml(data.quickSummary)}
          </div>
        </div>
      `;
    }

    outputContainer.innerHTML = `
      <div class="notes-container">
        ${headerHtml}
        ${overviewHtml}
        ${conceptsHtml}
        ${codeHtml}
        ${pitfallsHtml}
        ${summaryHtml}
      </div>
    `;

    // Hook up copy button
    const copyNotesBtn = document.getElementById('copyNotesBtn');
    const copyBtnText = document.getElementById('copyBtnText');
    if (copyNotesBtn) {
      copyNotesBtn.addEventListener('click', () => {
        const fullNotesText = `STUDY NOTES: ${topic} (${difficulty.toUpperCase()})\n\n` +
          `OVERVIEW:\n${data.overview || ''}\n\n` +
          `KEY CONCEPTS:\n${keyConcepts.map(c => `- ${c.title}: ${c.explanation}`).join('\n')}\n\n` +
          (data.codeOrExample ? `EXAMPLE:\n${data.codeOrExample}\n\n` : '') +
          (pitfalls.length ? `COMMON PITFALLS:\n${pitfalls.map(p => `- ${p}`).join('\n')}\n\n` : '') +
          `QUICK SUMMARY:\n${data.quickSummary || ''}`;

        navigator.clipboard.writeText(fullNotesText).then(() => {
          copyBtnText.textContent = 'Copied!';
          setTimeout(() => { copyBtnText.textContent = 'Copy Notes'; }, 2000);
        }).catch(() => {
          copyBtnText.textContent = 'Copy failed';
        });
      });
    }
  }

  // ==========================================================================
  // Mode 2: Render MCQ Quiz with Interactive Scoring
  // ==========================================================================
  function renderQuiz(data, difficulty) {
    const topic = data.topic || topicInput.value;
    const questions = Array.isArray(data.questions) ? data.questions : [];

    // Initialize Quiz state
    quizState = {
      questions: questions,
      answeredCount: 0,
      score: 0,
      total: questions.length
    };

    // Header
    const headerHtml = `
      <div class="content-card-header">
        <div class="content-topic-info">
          <h3 class="content-topic-title">${escapeHtml(topic)}</h3>
          <span class="tag-badge mode-quiz">🎯 MCQ Quiz</span>
          <span class="tag-badge ${escapeHtml(difficulty)}">${escapeHtml(difficulty)}</span>
        </div>
        <div class="header-actions">
          <button type="button" class="secondary-btn" id="retakeQuizBtn">
            <span>🔄</span> <span>Retake Quiz</span>
          </button>
        </div>
      </div>
    `;

    // Score Banner
    const scoreBannerHtml = `
      <div class="quiz-score-banner" id="quizScoreBanner">
        <div class="quiz-score-text">
          <span>Your Score: </span>
          <span class="score-badge" id="scoreDisplay">0 / ${quizState.total}</span>
        </div>
        <div id="quizStatusMessage" style="font-size: 0.88rem; color: var(--text-muted);">
          Select an option for each question to see immediate feedback.
        </div>
        <div class="quiz-progress-bar">
          <div class="quiz-progress-fill" id="quizProgressBar"></div>
        </div>
      </div>
    `;

    // Render Question Cards
    const questionsHtml = questions.map((q, qIndex) => {
      const optionsHtml = (q.options || []).map((opt, optIndex) => {
        const optionLetter = String.fromCharCode(65 + optIndex); // A, B, C, D
        return `
          <button type="button" 
                  class="option-btn" 
                  data-q-index="${qIndex}" 
                  data-opt-index="${optIndex}">
            <span class="option-prefix">${optionLetter}</span>
            <span class="option-label">${escapeHtml(opt)}</span>
          </button>
        `;
      }).join('');

      return `
        <div class="quiz-question-card" id="questionCard-${qIndex}">
          <div class="question-header">
            <span class="question-number">${qIndex + 1}</span>
            <h4 class="question-text">${escapeHtml(q.question)}</h4>
          </div>
          <div class="options-grid">
            ${optionsHtml}
          </div>
          <div class="quiz-explanation" id="explanation-${qIndex}">
            <strong>Explanation:</strong> ${escapeHtml(q.explanation || 'No explanation provided.')}
          </div>
        </div>
      `;
    }).join('');

    outputContainer.innerHTML = `
      <div class="quiz-container">
        ${headerHtml}
        ${scoreBannerHtml}
        ${questionsHtml}
      </div>
    `;

    // Attach click handlers to option buttons
    document.querySelectorAll('.option-btn').forEach(btn => {
      btn.addEventListener('click', handleOptionClick);
    });

    // Retake button
    const retakeBtn = document.getElementById('retakeQuizBtn');
    if (retakeBtn) {
      retakeBtn.addEventListener('click', () => {
        renderQuiz(data, difficulty);
      });
    }
  }

  /**
   * Handle user clicking an option in the MCQ Quiz
   */
  function handleOptionClick(e) {
    const btn = e.currentTarget;
    const qIndex = parseInt(btn.getAttribute('data-q-index'), 10);
    const selectedOptIndex = parseInt(btn.getAttribute('data-opt-index'), 10);

    const question = quizState.questions[qIndex];
    if (!question) return;

    const card = document.getElementById(`questionCard-${qIndex}`);
    const allOptionBtns = card.querySelectorAll('.option-btn');

    // Disable further clicks on this question
    allOptionBtns.forEach(b => b.disabled = true);

    const correctIndex = Number(question.correctIndex);
    const isCorrect = selectedOptIndex === correctIndex;

    // Visual styles for selected option
    if (isCorrect) {
      btn.classList.add('selected-correct');
      quizState.score++;
    } else {
      btn.classList.add('selected-incorrect');
      // Highlight the correct option so student learns
      allOptionBtns.forEach(b => {
        if (parseInt(b.getAttribute('data-opt-index'), 10) === correctIndex) {
          b.classList.add('reveal-correct');
        }
      });
    }

    // Reveal explanation
    const explBox = document.getElementById(`explanation-${qIndex}`);
    if (explBox) {
      explBox.classList.add('visible');
    }

    // Update Score & Progress Tracker
    quizState.answeredCount++;
    const scoreDisplay = document.getElementById('scoreDisplay');
    const progressBar = document.getElementById('quizProgressBar');
    const statusMsg = document.getElementById('quizStatusMessage');

    if (scoreDisplay) {
      scoreDisplay.textContent = `${quizState.score} / ${quizState.total}`;
    }

    if (progressBar) {
      const percentage = (quizState.answeredCount / quizState.total) * 100;
      progressBar.style.width = `${percentage}%`;
    }

    if (statusMsg && quizState.answeredCount === quizState.total) {
      const percentage = Math.round((quizState.score / quizState.total) * 100);
      if (percentage >= 80) {
        statusMsg.innerHTML = `🎉 <strong>Outstanding!</strong> You scored ${percentage}%. You have mastered this topic!`;
      } else if (percentage >= 60) {
        statusMsg.innerHTML = `👍 <strong>Good job!</strong> You scored ${percentage}%. Review the explanations above for quick improvement.`;
      } else {
        statusMsg.innerHTML = `📚 <strong>Keep practicing!</strong> You scored ${percentage}%. Click "Retake Quiz" to try again.`;
      }
    }
  }

  // ==========================================================================
  // Mode 3: Render Interview Prep Questions
  // ==========================================================================
  function renderInterview(data, difficulty) {
    const topic = data.topic || topicInput.value;
    const questions = Array.isArray(data.questions) ? data.questions : [];

    // Header
    const headerHtml = `
      <div class="content-card-header">
        <div class="content-topic-info">
          <h3 class="content-topic-title">${escapeHtml(topic)}</h3>
          <span class="tag-badge mode-interview">💼 Interview Prep</span>
          <span class="tag-badge ${escapeHtml(difficulty)}">${escapeHtml(difficulty)}</span>
        </div>
        <div class="header-actions">
          <button type="button" class="secondary-btn" id="expandAllBtn">
            <span>👁️</span> <span id="expandAllText">Expand All</span>
          </button>
        </div>
      </div>
    `;

    // Questions Accordion List
    const questionsHtml = questions.map((q, idx) => {
      const keyPoints = Array.isArray(q.keyPoints) ? q.keyPoints : [];
      const keyPointsHtml = keyPoints.map(pt => `<li>${escapeHtml(pt)}</li>`).join('');

      return `
        <div class="interview-card" id="interviewCard-${idx}">
          <div class="interview-card-header">
            <div class="interview-meta-row">
              <span class="tag-badge">Question ${idx + 1}</span>
              <span class="interview-q-type">${escapeHtml(q.questionType || 'Technical Interview')}</span>
            </div>
            <h4 class="interview-q-title">${escapeHtml(q.question)}</h4>
          </div>

          <button type="button" class="interview-accordion-toggle" data-card-id="interviewCard-${idx}">
            <span>💡 Reveal Model Answer & Evaluation Criteria</span>
            <span class="toggle-arrow" aria-hidden="true">&#9660;</span>
          </button>

          <div class="interview-answer-body">
            <div class="answer-section">
              <h6>Ideal Model Response</h6>
              <p class="answer-text">${escapeHtml(q.idealAnswer || 'No model answer provided.')}</p>
            </div>

            ${keyPoints.length > 0 ? `
              <div class="answer-section">
                <h6>What the Interviewer is Looking For</h6>
                <ul class="evaluation-points">
                  ${keyPointsHtml}
                </ul>
              </div>
            ` : ''}

            ${q.followUp ? `
              <div class="followup-box">
                <strong>Likely Follow-up Question:</strong> ${escapeHtml(q.followUp)}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    outputContainer.innerHTML = `
      <div class="interview-container">
        ${headerHtml}
        ${questionsHtml}
      </div>
    `;

    // Accordion toggle handlers
    document.querySelectorAll('.interview-accordion-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const cardId = btn.getAttribute('data-card-id');
        const card = document.getElementById(cardId);
        if (card) {
          card.classList.toggle('open');
        }
      });
    });

    // Expand All / Collapse All toggle button
    const expandAllBtn = document.getElementById('expandAllBtn');
    const expandAllText = document.getElementById('expandAllText');
    let allExpanded = false;

    if (expandAllBtn) {
      expandAllBtn.addEventListener('click', () => {
        allExpanded = !allExpanded;
        document.querySelectorAll('.interview-card').forEach(card => {
          if (allExpanded) {
            card.classList.add('open');
          } else {
            card.classList.remove('open');
          }
        });
        expandAllText.textContent = allExpanded ? 'Collapse All' : 'Expand All';
      });
    }
  }

  // ==========================================================================
  // Fallback: Render Raw Text Formatted Cleanly
  // ==========================================================================
  function renderRawContent(data) {
    const content = data.rawContent || JSON.stringify(data, null, 2);
    outputContainer.innerHTML = `
      <div class="content-card-header">
        <h3 class="content-topic-title">${escapeHtml(data.topic || 'Study Materials')}</h3>
        <span class="tag-badge">${escapeHtml(data.mode || 'Overview')}</span>
      </div>
      <div class="raw-content-box">${escapeHtml(content)}</div>
    `;
  }

  /**
   * Basic HTML entity escaping to prevent XSS injection
   */
  function escapeHtml(str) {
    if (typeof str !== 'string') return String(str || '');
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
