/* ── Skill Assessment UI ─────────────────────────────────────── */

let session      = null;   // {session_id, questions, experience_level}
let answers      = {};     // {q_id: answer_string}
let currentIndex = 0;
let timer        = null;
let timeLeft     = 0;

// ── Views ──────────────────────────────────────────────────────
const views = {
  start:    document.getElementById('assess-start'),
  loading:  document.getElementById('assess-loading'),
  question: document.getElementById('assess-question'),
  results:  document.getElementById('assess-results'),
};

function showView(name) {
  Object.values(views).forEach(v => { if (v) v.style.display = 'none'; });
  if (views[name]) views[name].style.display = 'block';
}

// ── Start ──────────────────────────────────────────────────────
document.getElementById('btn-start-assess')?.addEventListener('click', startAssessment);

async function startAssessment() {
  showView('loading');
  document.getElementById('loading-msg').textContent = 'Generating your personalised questions…';

  const res = await fetch('/api/v1/assessment/start', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token.get()}` },
  });

  const data = await res.json();

  if (!res.ok) {
    showView('start');
    toast('assess-toast', 'err', data?.detail || 'Failed to start assessment');
    return;
  }

  session      = data;
  answers      = {};
  currentIndex = 0;

  showView('question');
  renderQuestion(currentIndex);
}

// ── Render question ────────────────────────────────────────────
function renderQuestion(idx) {
  const q = session.questions[idx];
  if (!q) return;

  // Header
  document.getElementById('q-counter').textContent = `Question ${idx + 1} of ${session.questions.length}`;

  // Progress bar
  const pct = (idx / session.questions.length) * 100;
  document.getElementById('progress-fill').style.width = pct + '%';

  // Type badge
  const typeBadge = document.getElementById('q-type-badge');
  const typeMap = {
    fill_in_code:   ['fill',    'Fill in Code'],
    debug:          ['debug',   'Debug Code'],
    mcq:            ['mcq',     'MCQ'],
    predict_output: ['predict', 'Predict Output'],
  };
  const [cls, label] = typeMap[q.type] || ['fill', q.type];
  typeBadge.className = `q-type-badge ${cls}`;
  typeBadge.textContent = label;

  // Skills
  document.getElementById('q-skills').innerHTML =
    (q.skills_tested || []).map(s => `<span class="q-skill-tag">${s}</span>`).join('');

  // Question text
  document.getElementById('q-text').textContent = q.question;

  // Code snippet
  const codeEl = document.getElementById('q-code');
  if (q.code_snippet) {
    codeEl.textContent = q.code_snippet;
    codeEl.parentElement.style.display = 'block';
  } else {
    codeEl.parentElement.style.display = 'none';
  }

  // Answer area
  const mcqEl    = document.getElementById('q-mcq-options');
  const textEl   = document.getElementById('q-text-answer');

  if (q.type === 'mcq' && q.options) {
    mcqEl.style.display  = 'flex';
    textEl.style.display = 'none';
    renderMCQ(q);
  } else {
    mcqEl.style.display  = 'none';
    textEl.style.display = 'block';
    textEl.value = answers[q.id] || '';
    textEl.placeholder = q.type === 'fill_in_code'
      ? 'Type the missing line of code…'
      : q.type === 'debug'
      ? 'Describe the bug and the fix…'
      : 'Type the output…';
  }

  // Dots
  renderDots(idx);

  // Buttons
  document.getElementById('btn-prev').disabled = idx === 0;
  const isLast = idx === session.questions.length - 1;
  const nextBtn = document.getElementById('btn-next');
  nextBtn.textContent = isLast ? 'Submit Assessment' : 'Next →';
  nextBtn.className   = isLast ? 'btn btn-primary' : 'btn btn-ghost';

  // Timer
  startTimer(q.time_limit || 45);
}

function renderMCQ(q) {
  const wrap = document.getElementById('q-mcq-options');
  wrap.innerHTML = '';
  const saved = answers[q.id];

  Object.entries(q.options).forEach(([key, val]) => {
    const div = document.createElement('div');
    div.className = `mcq-option${saved === key ? ' selected' : ''}`;
    div.innerHTML = `
      <div class="opt-key">${key.toUpperCase()}</div>
      <div class="opt-text">${val}</div>`;
    div.addEventListener('click', () => {
      document.querySelectorAll('.mcq-option').forEach(o => o.classList.remove('selected'));
      div.classList.add('selected');
      answers[q.id] = key;
      renderDots(currentIndex);
    });
    wrap.appendChild(div);
  });
}

function renderDots(currentIdx) {
  const wrap = document.getElementById('q-dots');
  wrap.innerHTML = '';
  session.questions.forEach((q, i) => {
    const dot = document.createElement('div');
    dot.className = 'q-dot' +
      (i === currentIdx ? ' current' : '') +
      (answers[q.id] ? ' answered' : '');
    wrap.appendChild(dot);
  });
}

// ── Timer ──────────────────────────────────────────────────────
function startTimer(seconds) {
  clearInterval(timer);
  timeLeft = seconds;
  updateTimerDisplay();

  timer = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();
    if (timeLeft <= 0) {
      clearInterval(timer);
      // Auto-save blank + move forward
      saveCurrentAnswer();
      moveNext();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const el = document.getElementById('timer-circle');
  if (!el) return;
  el.textContent = timeLeft;
  el.className = 'timer-circle' +
    (timeLeft <= 5  ? ' danger' :
     timeLeft <= 15 ? ' warn'   : '');
}

// ── Navigation ─────────────────────────────────────────────────
document.getElementById('btn-next')?.addEventListener('click', () => {
  saveCurrentAnswer();
  const isLast = currentIndex === session.questions.length - 1;
  if (isLast) {
    submitAssessment();
  } else {
    moveNext();
  }
});

document.getElementById('btn-prev')?.addEventListener('click', () => {
  saveCurrentAnswer();
  if (currentIndex > 0) {
    currentIndex--;
    renderQuestion(currentIndex);
  }
});

function saveCurrentAnswer() {
  const q = session?.questions?.[currentIndex];
  if (!q) return;
  if (q.type === 'mcq') return; // MCQ saves on click
  const val = document.getElementById('q-text-answer')?.value?.trim();
  if (val) answers[q.id] = val;
}

function moveNext() {
  if (currentIndex < session.questions.length - 1) {
    currentIndex++;
    renderQuestion(currentIndex);
  }
}

// ── Submit ─────────────────────────────────────────────────────
async function submitAssessment() {
  clearInterval(timer);
  showView('loading');
  document.getElementById('loading-msg').textContent = 'Evaluating your answers with AI…';

  const answerList = session.questions.map(q => ({
    question_id:  q.id,
    user_answer:  answers[q.id] || '',
  }));

  const res = await fetch('/api/v1/assessment/submit', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token.get()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      session_id: session.session_id,
      answers:    answerList,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    showView('question');
    toast('assess-toast', 'err', data?.detail || 'Submission failed');
    return;
  }

  renderResults(data);
  showView('results');
}

// ── Render results ─────────────────────────────────────────────
function renderResults(data) {
  const list = document.getElementById('skills-list');
  list.innerHTML = '';

  if (!data.skills?.length) {
    list.innerHTML = '<p style="color:var(--text-3);text-align:center;padding:16px">No skills detected.</p>';
    return;
  }

  // Sort by score descending
  const sorted = [...data.skills].sort((a, b) => b.confidence_score - a.confidence_score);

  sorted.forEach(sk => {
    const score = Math.round(sk.confidence_score);
    const level = sk.confidence_level;
    const row = document.createElement('div');
    row.className = 'skill-row';
    row.style.flexDirection = 'column';
    row.style.alignItems = 'stretch';
    row.innerHTML = `
      <div style="display:flex;align-items:center;gap:14px">
        <span class="sk-name">${sk.name}</span>
        <div class="sk-bar-wrap">
          <div class="sk-bar ${level}" style="width:0%" data-target="${score}"></div>
        </div>
        <span class="sk-score" style="color:${level==='high'?'#4ade80':level==='medium'?'#fde047':'#f87171'}">${score}%</span>
        <span class="sk-level ${level}">${level}</span>
      </div>
      ${sk.evidence_text ? `<div class="sk-evidence">${sk.evidence_text}</div>` : ''}
    `;
    list.appendChild(row);
  });

  // Animate bars
  setTimeout(() => {
    document.querySelectorAll('.sk-bar').forEach(bar => {
      bar.style.width = bar.dataset.target + '%';
    });
  }, 100);
}

// ── Retry ──────────────────────────────────────────────────────
document.getElementById('btn-retry')?.addEventListener('click', () => {
  session = null; answers = {}; currentIndex = 0;
  showView('start');
});
