/* ── Collaboration Assessment UI ─────────────────────────────── */

let collabSession   = null;   // { assessment_id, questions, total_questions }
let collabAnswers   = {};     // { question_id: response (1-5) }
let collabIndex     = 0;

// Dimension display names
const DIM_LABELS = {
  LEADERSHIP:    'Leadership',
  COMMUNICATION: 'Communication',
  COLLABORATION: 'Collaboration',
  RELIABILITY:   'Reliability',
  ADAPTABILITY:  'Adaptability',
  INITIATIVE:    'Initiative',
};

// ── View helpers ───────────────────────────────────────────────
const collabViews = {
  start:    document.getElementById('collab-start'),
  loading:  document.getElementById('collab-loading'),
  question: document.getElementById('collab-question'),
  complete: document.getElementById('collab-complete'),
};

function collabShowView(name) {
  Object.values(collabViews).forEach(v => { if (v) v.style.display = 'none'; });
  if (collabViews[name]) collabViews[name].style.display = 'block';
}

// ── Check status on page open ──────────────────────────────────
// Called by app.js when the user navigates to the collaboration page.
async function onCollabPageOpen() {
  const res = await Api.collabStatus();
  if (res.ok && res.data.completed) {
    // User has a completed assessment — offer to view results or retake
    await loadCollabResult();
  }
  // else: show start screen (default)
}

// ── Start ──────────────────────────────────────────────────────
document.getElementById('btn-collab-start')?.addEventListener('click', startCollabAssessment);

async function startCollabAssessment() {
  collabShowView('loading');
  document.getElementById('collab-loading-msg').textContent = 'Preparing your questions…';

  const res = await Api.collabStart();

  if (!res.ok) {
    collabShowView('start');
    toast('collab-toast', 'err', res.data?.detail || 'Failed to start assessment');
    return;
  }

  collabSession = res.data;   // { assessment_id, questions, total_questions }
  collabAnswers = {};
  collabIndex   = 0;

  collabShowView('question');
  renderCollabQuestion(0);
}

// ── Render a question ──────────────────────────────────────────
function renderCollabQuestion(idx) {
  const q = collabSession.questions[idx];
  if (!q) return;

  const total = collabSession.total_questions;

  // Progress
  document.getElementById('collab-progress-fill').style.width =
    ((idx / total) * 100) + '%';
  document.getElementById('collab-q-counter').textContent =
    `${idx + 1} of ${total}`;

  // Dimension badge
  const dimBadge = document.getElementById('collab-dim-badge');
  dimBadge.textContent = DIM_LABELS[q.dimension] || q.dimension;

  // Statement text
  document.getElementById('collab-q-text').textContent = q.question;

  // Restore previous answer if any
  const saved = collabAnswers[q.id];
  document.querySelectorAll('.likert-btn').forEach(btn => {
    btn.classList.toggle('selected', String(btn.dataset.val) === String(saved));
  });

  // Next button state — only enabled once an answer is selected
  updateCollabNextBtn();

  // Dots
  renderCollabDots(idx);

  // Back button
  document.getElementById('btn-collab-prev').disabled = (idx === 0);
}

// ── Likert click handler ───────────────────────────────────────
document.getElementById('collab-likert')?.addEventListener('click', e => {
  const btn = e.target.closest('.likert-btn');
  if (!btn) return;

  const val = parseInt(btn.dataset.val);
  const q   = collabSession?.questions?.[collabIndex];
  if (!q) return;

  collabAnswers[q.id] = val;

  document.querySelectorAll('.likert-btn').forEach(b =>
    b.classList.toggle('selected', b === btn)
  );

  renderCollabDots(collabIndex);
  updateCollabNextBtn();
});

function updateCollabNextBtn() {
  const q       = collabSession?.questions?.[collabIndex];
  const hasAns  = q && collabAnswers[q.id] !== undefined;
  const isLast  = collabIndex === (collabSession?.total_questions ?? 12) - 1;
  const nextBtn = document.getElementById('btn-collab-next');

  nextBtn.disabled   = !hasAns;
  nextBtn.textContent = isLast ? 'Submit ✓' : 'Next →';
  nextBtn.className   = isLast
    ? 'btn btn-primary' + (hasAns ? '' : ' btn-disabled')
    : 'btn btn-ghost btn-sm';
}

// ── Dots ───────────────────────────────────────────────────────
function renderCollabDots(currentIdx) {
  const wrap = document.getElementById('collab-dots');
  if (!wrap || !collabSession) return;
  wrap.innerHTML = '';

  collabSession.questions.forEach((q, i) => {
    const dot = document.createElement('div');
    dot.className = 'q-dot' +
      (i === currentIdx          ? ' current'  : '') +
      (collabAnswers[q.id] != null ? ' answered' : '');
    wrap.appendChild(dot);
  });
}

// ── Navigation ─────────────────────────────────────────────────
document.getElementById('btn-collab-next')?.addEventListener('click', () => {
  if (!collabSession) return;
  const isLast = collabIndex === collabSession.total_questions - 1;
  if (isLast) {
    submitCollabAssessment();
  } else {
    collabIndex++;
    renderCollabQuestion(collabIndex);
  }
});

document.getElementById('btn-collab-prev')?.addEventListener('click', () => {
  if (collabIndex > 0) {
    collabIndex--;
    renderCollabQuestion(collabIndex);
  }
});

// ── Submit ─────────────────────────────────────────────────────
async function submitCollabAssessment() {
  collabShowView('loading');
  document.getElementById('collab-loading-msg').textContent = 'Saving your responses…';

  const answers = collabSession.questions.map(q => ({
    question_id: q.id,
    response:    collabAnswers[q.id] ?? 3,   // default neutral if somehow unanswered
  }));

  const res = await Api.collabSubmit({
    assessment_id: collabSession.assessment_id,
    answers,
  });

  if (!res.ok) {
    collabShowView('question');
    toast('collab-toast', 'err', res.data?.detail || 'Submission failed');
    return;
  }

  renderCollabScores(res.data.dimension_scores);
  collabShowView('complete');
}

// ── Load existing result ───────────────────────────────────────
async function loadCollabResult() {
  const res = await Api.collabResult();
  if (res.ok && res.data.dimension_scores?.length) {
    renderCollabScores(res.data.dimension_scores);
    collabShowView('complete');
  }
  // else fall through to start screen
}

// ── Render scores ──────────────────────────────────────────────
function renderCollabScores(scores) {
  const list = document.getElementById('collab-scores-list');
  if (!list) return;
  list.innerHTML = '';

  // Sort by percentage descending
  const sorted = [...scores].sort((a, b) => b.percentage - a.percentage);

  sorted.forEach(s => {
    const pct    = s.percentage;
    const barCls = pct >= 70 ? 'score-high' : pct >= 40 ? 'score-mid' : 'score-low';
    const label  = DIM_LABELS[s.dimension] || s.dimension;

    const row = document.createElement('div');
    row.className = 'collab-score-row';
    row.innerHTML = `
      <span class="cs-dim">${label}</span>
      <div class="cs-bar-wrap">
        <div class="cs-bar ${barCls}" style="width:0%" data-target="${pct}"></div>
      </div>
      <span class="cs-pct">${pct}%</span>
    `;
    list.appendChild(row);
  });

  // Animate bars after paint
  requestAnimationFrame(() => {
    setTimeout(() => {
      list.querySelectorAll('.cs-bar').forEach(bar => {
        bar.style.width = bar.dataset.target + '%';
      });
    }, 80);
  });
}

// ── Retake ─────────────────────────────────────────────────────
document.getElementById('btn-collab-retake')?.addEventListener('click', () => {
  collabSession = null;
  collabAnswers = {};
  collabIndex   = 0;
  collabShowView('start');
});

// ── Hook into page navigation ──────────────────────────────────
// Patch the global showPage function to trigger status check when
// the user opens the collaboration page.
(function patchShowPage() {
  const _orig = window.showPage;
  window.showPage = function(name) {
    _orig(name);
    if (name === 'collaboration') {
      onCollabPageOpen();
    }
  };
})();
