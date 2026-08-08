/* ── Profile Page Logic ───────────────────────────────────── */

// ── Create Profile ────────────────────────────────────────
document.getElementById('btn-create-profile')?.addEventListener('click', async () => {
  const btn = document.getElementById('btn-create-profile');
  if (!Api.getToken()) return showAlert('profile-alert', 'error', 'You must be logged in first');

  const days = [...document.querySelectorAll('.day-check:checked')].map(c => c.value);

  const payload = {
    name:             document.getElementById('p-name').value.trim(),
    college:          document.getElementById('p-college').value.trim()  || undefined,
    degree:           document.getElementById('p-degree').value.trim()   || undefined,
    year_of_study:    parseInt(document.getElementById('p-year').value)  || undefined,
    github_url:       document.getElementById('p-github').value.trim()   || undefined,
    linkedin_url:     document.getElementById('p-linkedin').value.trim() || undefined,
    leetcode_url:     document.getElementById('p-leetcode').value.trim() || undefined,
    experience_level: document.getElementById('p-exp').value             || undefined,
    availability: {
      working_days:     days.length ? days : undefined,
      working_hours:    document.getElementById('p-hours').value.trim()  || undefined,
      timezone:         document.getElementById('p-tz').value.trim()     || undefined,
      commitment_level: document.getElementById('p-commit').value        || undefined,
    }
  };

  if (!payload.name) return showAlert('profile-alert', 'error', 'Name is required');

  // Clean undefined
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
  if (payload.availability)
    Object.keys(payload.availability).forEach(k => payload.availability[k] === undefined && delete payload.availability[k]);

  setBtnLoading(btn, true);
  const res = await Api.createProfile(payload);
  setBtnLoading(btn, false);

  renderResponse('profile-response', res.status, res.data);

  if (res.ok) {
    showAlert('profile-alert', 'success', 'Profile created successfully');
    displayProfile(res.data);
  } else {
    showAlert('profile-alert', 'error', res.data?.detail || 'Failed to create profile');
  }
});

// ── Get Profile ───────────────────────────────────────────
document.getElementById('btn-get-profile')?.addEventListener('click', async () => {
  const btn = document.getElementById('btn-get-profile');
  if (!Api.getToken()) return showAlert('profile-alert', 'error', 'You must be logged in first');

  setBtnLoading(btn, true);
  const res = await Api.getProfile();
  setBtnLoading(btn, false);

  renderResponse('profile-response', res.status, res.data);

  if (res.ok) {
    showAlert('profile-alert', 'success', 'Profile loaded');
    displayProfile(res.data);
    prefillUpdateForm(res.data);
  } else {
    showAlert('profile-alert', 'error', res.data?.detail || 'Profile not found');
  }
});

// ── Update Profile ────────────────────────────────────────
document.getElementById('btn-update-profile')?.addEventListener('click', async () => {
  const btn = document.getElementById('btn-update-profile');
  if (!Api.getToken()) return showAlert('profile-alert', 'error', 'You must be logged in first');

  const payload = {};
  const fields = ['u-name','u-college','u-degree','u-year','u-github','u-linkedin','u-leetcode','u-exp'];
  const keys   = ['name','college','degree','year_of_study','github_url','linkedin_url','leetcode_url','experience_level'];

  fields.forEach((id, i) => {
    const val = document.getElementById(id)?.value?.trim();
    if (val) payload[keys[i]] = keys[i] === 'year_of_study' ? parseInt(val) : val;
  });

  setBtnLoading(btn, true);
  const res = await Api.updateProfile(payload);
  setBtnLoading(btn, false);

  renderResponse('profile-response', res.status, res.data);

  if (res.ok) {
    showAlert('profile-alert', 'success', 'Profile updated');
    displayProfile(res.data);
  } else {
    showAlert('profile-alert', 'error', res.data?.detail || 'Update failed');
  }
});

// ── Upload Resume ─────────────────────────────────────────
document.getElementById('btn-upload-resume')?.addEventListener('click', async () => {
  const btn      = document.getElementById('btn-upload-resume');
  const fileInput = document.getElementById('resume-file');
  const file = fileInput?.files?.[0];

  if (!Api.getToken()) return showAlert('resume-alert', 'error', 'You must be logged in first');
  if (!file)           return showAlert('resume-alert', 'error', 'Please select a PDF file');

  setBtnLoading(btn, true);
  const res = await Api.uploadResume(file);
  setBtnLoading(btn, false);

  renderResponse('resume-response', res.status, res.data);

  if (res.ok) {
    showAlert('resume-alert', 'success', `Resume "${res.data.original_filename}" uploaded — status: ${res.data.parse_status}`);
  } else {
    showAlert('resume-alert', 'error', res.data?.detail || 'Upload failed');
  }
});

// ── Drag & drop on upload zone ────────────────────────────
document.getElementById('resume-file')?.addEventListener('change', e => {
  const name = e.target.files[0]?.name;
  const el = document.getElementById('upload-filename');
  if (el) el.textContent = name ? `Selected: ${name}` : '';
});

document.querySelector('.upload-zone')?.addEventListener('dragover', e => {
  e.preventDefault();
  e.currentTarget.classList.add('dragover');
});

document.querySelector('.upload-zone')?.addEventListener('dragleave', e => {
  e.currentTarget.classList.remove('dragover');
});

document.querySelector('.upload-zone')?.addEventListener('drop', e => {
  e.preventDefault();
  e.currentTarget.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) {
    document.getElementById('resume-file').files = e.dataTransfer.files;
    const el = document.getElementById('upload-filename');
    if (el) el.textContent = `Selected: ${file.name}`;
  }
});

// ── Display profile card ──────────────────────────────────
function displayProfile(p) {
  const card = document.getElementById('profile-display');
  if (!card) return;
  card.style.display = 'block';

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '—';
  };

  set('dp-name',    p.name);
  set('dp-college', p.college);
  set('dp-degree',  p.degree);
  set('dp-year',    p.year_of_study);
  set('dp-exp',     p.experience_level);
  set('dp-github',  p.github_url);
  set('dp-linkedin',p.linkedin_url);
  set('dp-lc',      p.leetcode_url);

  // Availability
  const av = p.availability;
  if (av) {
    set('dp-hours',  av.working_hours);
    set('dp-tz',     av.timezone);
    set('dp-commit', av.commitment_level);

    const daysEl = document.getElementById('dp-days');
    if (daysEl) {
      daysEl.innerHTML = av.working_days?.length
        ? av.working_days.map(d => `<span class="chip">${d}</span>`).join('')
        : '<span class="chip">—</span>';
    }
  }

  // Skills / Projects counts
  set('dp-skills-count',   p.skills?.length   ?? 0);
  set('dp-projects-count', p.projects?.length ?? 0);

  // Update stats row
  document.getElementById('stat-skills')?.   (() => {})();
  updateStats(p);
}

function updateStats(p) {
  const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  s('stat-skills',   p.skills?.length   ?? 0);
  s('stat-projects', p.projects?.length ?? 0);
  s('stat-personality', p.personality ? 'Done' : 'Pending');
  s('stat-exp', p.experience_level ?? '—');
}

function prefillUpdateForm(p) {
  const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
  set('u-name',     p.name);
  set('u-college',  p.college);
  set('u-degree',   p.degree);
  set('u-year',     p.year_of_study);
  set('u-github',   p.github_url);
  set('u-linkedin', p.linkedin_url);
  set('u-leetcode', p.leetcode_url);
  set('u-exp',      p.experience_level);
}
