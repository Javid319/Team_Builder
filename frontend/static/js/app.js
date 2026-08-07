// Guard — redirect to login if no token
if (!token.get()) window.location.href = '/';

let currentUser   = null;
let currentProfile = null;
let profileExists  = false;

// ── Init ─────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {

  // 1. Verify token, get user
  const me = await Api.me();
  if (!me.ok) { token.clear(); window.location.href = '/'; return; }

  currentUser = me.data;
  const name  = currentUser.full_name || currentUser.email.split('@')[0];
  document.getElementById('topbar-avatar').textContent = name[0].toUpperCase();
  document.getElementById('topbar-email').textContent  = currentUser.email;
  document.getElementById('dash-greeting').textContent = `Hello, ${name} 👋`;

  // 2. Wire up day-btn toggles BEFORE loading profile (so prefill works)
  document.querySelectorAll('.day-btn').forEach(btn => {
    btn.addEventListener('click', () => btn.classList.toggle('selected'));
  });

  // 3. Load profile (will prefill form and render dashboard)
  await loadProfile();

  // 4. Other event listeners
  document.getElementById('btn-save-profile')?.addEventListener('click', saveProfile);
  document.getElementById('btn-add-skill')?.addEventListener('click', addSkill);
  document.getElementById('btn-logout')?.addEventListener('click', () => {
    token.clear();
    window.location.href = '/';
  });
  document.getElementById('btn-upload')?.addEventListener('click', uploadResume);
  document.getElementById('resume-input')?.addEventListener('change', e => {
    document.getElementById('resume-filename').textContent = e.target.files[0]?.name || '';
  });

  // Drag & drop
  const zone = document.getElementById('upload-zone');
  if (zone) {
    zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag'); });
    zone.addEventListener('dragleave', ()  => zone.classList.remove('drag'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag');
      const f = e.dataTransfer.files[0];
      if (f) {
        document.getElementById('resume-input').files = e.dataTransfer.files;
        document.getElementById('resume-filename').textContent = f.name;
      }
    });
  }
});

// ── Page routing ──────────────────────────────────
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${name}`)?.classList.add('active');
  document.getElementById(`nav-${name}`)?.classList.add('active');
}

// ── Load & render profile ─────────────────────────
async function loadProfile() {
  const res = await Api.getProfile();

  if (res.ok) {
    currentProfile = res.data;
    profileExists  = true;
    renderDashboard(res.data);
    prefillEditForm(res.data);
    await loadSkills();
  } else {
    profileExists = false;
    // Show "no profile" state on dashboard
    const banner = document.getElementById('profile-banner-wrap');
    const prompt = document.getElementById('no-profile-prompt');
    if (banner) banner.style.display = 'none';
    if (prompt) prompt.style.display = 'block';
  }
}

// ── Dashboard ─────────────────────────────────────
function renderDashboard(p) {
  const banner = document.getElementById('profile-banner-wrap');
  const prompt = document.getElementById('no-profile-prompt');
  if (banner) banner.style.display = 'block';
  if (prompt) prompt.style.display = 'none';

  const name = p.name || currentUser?.email?.split('@')[0] || '?';
  const avatarEl = document.getElementById('dash-avatar');
  const nameEl   = document.getElementById('dash-name');
  const metaEl   = document.getElementById('dash-meta');
  if (avatarEl) avatarEl.textContent = name[0].toUpperCase();
  if (nameEl)   nameEl.textContent   = name;
  if (metaEl)   metaEl.textContent   =
    [p.college, p.degree, p.year_of_study && `Year ${p.year_of_study}`]
      .filter(Boolean).join(' · ') || 'No details added yet';

  const se = document.getElementById('s-skills');
  const sp = document.getElementById('s-projects');
  const sx = document.getElementById('s-exp');
  if (se) se.textContent = p.skills?.length   ?? 0;
  if (sp) sp.textContent = p.projects?.length ?? 0;
  if (sx) sx.textContent = p.experience_level ?? '—';
}

// ── Save profile (create or update) ──────────────
async function saveProfile() {
  const btn = document.getElementById('btn-save-profile');

  const days = [...document.querySelectorAll('.day-btn.selected')].map(d => d.dataset.day);

  const avail = clean({
    working_days:     days.length ? days : undefined,
    working_hours:    v('e-hours'),
    timezone:         v('e-tz'),
    commitment_level: v('e-commit'),
  });

  const payload = clean({
    name:             v('e-name'),
    college:          v('e-college'),
    degree:           v('e-degree'),
    year_of_study:    iv('e-year'),
    experience_level: v('e-exp'),
    github_url:       v('e-github'),
    linkedin_url:     v('e-linkedin'),
    leetcode_url:     v('e-leetcode'),
    availability:     Object.keys(avail).length ? avail : undefined,
  });

  if (!payload.name) return toast('edit-toast', 'err', 'Name is required');

  setLoading(btn, true);
  const isNew = !profileExists;
  const res   = isNew
    ? await Api.createProfile(payload)
    : await Api.updateProfile(payload);
  setLoading(btn, false);

  if (res.ok) {
    profileExists  = true;
    currentProfile = res.data;
    toast('edit-toast', 'ok', isNew ? 'Profile created!' : 'Profile updated');
    renderDashboard(res.data);
  } else {
    const detail = res.data?.detail;
    const msg = typeof detail === 'string'
      ? detail
      : Array.isArray(detail)
        ? detail.map(e => e.msg).join(', ')
        : 'Save failed';
    toast('edit-toast', 'err', msg);
  }
}

// ── Prefill edit form ─────────────────────────────
function prefillEditForm(p) {
  sv('e-name',     p.name);
  sv('e-college',  p.college);
  sv('e-degree',   p.degree);
  sv('e-year',     p.year_of_study);
  sv('e-github',   p.github_url);
  sv('e-linkedin', p.linkedin_url);
  sv('e-leetcode', p.leetcode_url);
  sv('e-exp',      p.experience_level);

  const av = p.availability;
  if (av) {
    sv('e-hours',  av.working_hours);
    sv('e-tz',     av.timezone);
    sv('e-commit', av.commitment_level);

    const selected = av.working_days || [];
    document.querySelectorAll('.day-btn').forEach(btn => {
      btn.classList.toggle('selected', selected.includes(btn.dataset.day));
    });
  }
}

// ── Upload resume ─────────────────────────────────
async function uploadResume() {
  const btn  = document.getElementById('btn-upload');
  const file = document.getElementById('resume-input').files[0];

  if (!file)          return toast('resume-toast', 'err', 'Select a PDF file first');
  if (!profileExists) return toast('resume-toast', 'err', 'Create a profile before uploading a resume');

  setLoading(btn, true);
  const res = await Api.uploadResume(file);
  setLoading(btn, false);

  showResp('resume-resp', res.status, res.data);

  if (res.ok) {
    toast('resume-toast', 'ok', `"${res.data.original_filename}" uploaded · status: ${res.data.parse_status}`);
  } else {
    toast('resume-toast', 'err', res.data?.detail || 'Upload failed');
  }
}

// ── Helpers ───────────────────────────────────────
const v     = id => document.getElementById(id)?.value?.trim() || undefined;
const iv    = id => { const n = parseInt(document.getElementById(id)?.value); return isNaN(n) ? undefined : n; };
const sv    = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
const clean = obj => { Object.keys(obj).forEach(k => { if (obj[k] === undefined || obj[k] === null) delete obj[k]; }); return obj; };

// ── Skills ────────────────────────────────────────────────────
let skillsCache = [];

function handleSkillSelect(sel) {
  const custom = document.getElementById('sk-name-custom');
  if (sel.value === '__custom__') {
    custom.style.display = 'block';
    custom.focus();
  } else {
    custom.style.display = 'none';
  }
}

function resetSkillSelect() {
  const sel = document.getElementById('sk-name-select');
  const custom = document.getElementById('sk-name-custom');
  if (!custom.value) {
    sel.value = '';
    custom.style.display = 'none';
  }
}

function getSkillName() {
  const sel    = document.getElementById('sk-name-select');
  const custom = document.getElementById('sk-name-custom');
  if (sel.value === '__custom__') return custom.value.trim();
  return sel.value.trim();
}

async function loadSkills() {
  if (!profileExists) return;
  const res = await Api.getSkills();
  if (res.ok) {
    skillsCache = res.data;
    renderSkills(res.data);
  }
}

async function addSkill() {
  const btn      = document.getElementById('btn-add-skill');
  const name     = getSkillName();
  const category = document.getElementById('sk-category').value.trim();
  const level    = document.getElementById('sk-level').value;

  if (!name) return toast('skill-toast', 'err', 'Select or type a skill name');
  if (!profileExists) return toast('skill-toast', 'err', 'Save your profile first');

  setLoading(btn, true);
  const res = await Api.addSkill({
    name,
    category:         category || undefined,
    confidence_level: level    || undefined,
    source:           'manual',
  });
  setLoading(btn, false);

  if (res.ok) {
    // Reset fields
    document.getElementById('sk-name-select').value  = '';
    document.getElementById('sk-name-custom').value  = '';
    document.getElementById('sk-name-custom').style.display = 'none';
    document.getElementById('sk-category').value     = '';
    document.getElementById('sk-level').value        = '';
    skillsCache.push(res.data);
    renderSkills(skillsCache);
    toast('skill-toast', 'ok', `"${res.data.name}" added`);
    const se = document.getElementById('s-skills');
    if (se) se.textContent = skillsCache.length;
  } else {
    toast('skill-toast', 'err', res.data?.detail || 'Failed to add skill');
  }
}

async function removeSkill(skillId) {
  const res = await Api.deleteSkill(skillId);
  if (res.ok || res.status === 204) {
    skillsCache = skillsCache.filter(s => s.id !== skillId);
    renderSkills(skillsCache);
    const se = document.getElementById('s-skills');
    if (se) se.textContent = skillsCache.length;
  } else {
    toast('skill-toast', 'err', 'Failed to delete skill');
  }
}

function renderSkills(skills) {
  const list  = document.getElementById('skill-list');
  const empty = document.getElementById('skill-empty');
  if (!list) return;

  if (!skills.length) {
    list.innerHTML = '';
    if (empty) { empty.style.display = 'inline'; list.appendChild(empty); }
    return;
  }

  if (empty) empty.style.display = 'none';

  const levelColor = { high: '#4ade80', medium: '#fde047', low: '#f87171', '': '#a1a1aa' };
  const levelLabel = { high: 'Advanced', medium: 'Intermediate', low: 'Beginner', '': '' };

  list.innerHTML = skills.map(sk => {
    const lvl   = sk.confidence_level || '';
    const color = levelColor[lvl] || '#a1a1aa';
    const label = levelLabel[lvl] || '';
    return `
      <div style="
        display:inline-flex;align-items:center;gap:8px;
        padding:6px 12px;border-radius:20px;
        background:var(--surface-2);border:1px solid var(--border);
        font-size:0.8rem;
      ">
        <span style="font-weight:600;color:var(--text)">${sk.name}</span>
        ${sk.category ? `<span style="color:var(--text-3)">${sk.category}</span>` : ''}
        ${label ? `<span style="color:${color};font-size:0.72rem;font-weight:600">${label}</span>` : ''}
        <span
          onclick="removeSkill('${sk.id}')"
          style="cursor:pointer;color:var(--text-3);line-height:1;margin-left:2px"
          title="Remove skill"
        >✕</span>
      </div>`;
  }).join('');
}
