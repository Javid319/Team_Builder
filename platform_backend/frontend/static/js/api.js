const API = '/api/v1';

const token = {
  get:   ()  => localStorage.getItem('hc_token'),
  set:   (t) => localStorage.setItem('hc_token', t),
  clear: ()  => localStorage.removeItem('hc_token'),
};

async function req(method, path, body = null, isForm = false) {
  const headers = {};
  const t = token.get();
  if (t) headers['Authorization'] = `Bearer ${t}`;
  if (body && !isForm) headers['Content-Type'] = 'application/json';

  const res = await fetch(API + path, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : null,
  });

  let data;
  try { data = await res.json(); } catch { data = null; }
  return { ok: res.ok, status: res.status, data };
}

const Api = {
  register:      (b) => req('POST',  '/auth/register', b),
  login:         (b) => req('POST',  '/auth/login',    b),
  me:            ()  => req('GET',   '/auth/me'),
  createProfile: (b) => req('POST',  '/profile/', b),
  getProfile:    ()  => req('GET',   '/profile/'),
  updateProfile: (b) => req('PATCH', '/profile/', b),
  uploadResume:  (f) => {
    const fd = new FormData();
    fd.append('file', f);
    return req('POST', '/profile/resume', fd, true);
  },
  addSkill:    (b)  => req('POST',   '/profile/skills', b),
  getSkills:   ()   => req('GET',    '/profile/skills'),
  deleteSkill: (id) => req('DELETE', `/profile/skills/${id}`),

  // Collaboration Assessment
  collabStart:   ()  => req('POST', '/collaboration/start'),
  collabSubmit:  (b) => req('POST', '/collaboration/submit', b),
  collabResult:  ()  => req('GET',  '/collaboration/result'),
  collabStatus:  ()  => req('GET',  '/collaboration/status'),
  collabSessions:()  => req('GET',  '/collaboration/sessions'),
};

/* ── helpers ── */
function hlJson(json) {
  return json
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      m => {
        let c = 'jn';
        if (/^"/.test(m)) c = /:$/.test(m) ? 'jk' : 'js';
        else if (/true|false/.test(m)) c = 'jb';
        else if (/null/.test(m)) c = 'jz';
        return `<span class="${c}">${m}</span>`;
      }
    );
}

function showResp(boxId, status, data) {
  const box = document.getElementById(boxId);
  if (!box) return;
  box.style.display = 'block';
  const badge = box.querySelector('.status-badge');
  const body  = box.querySelector('.resp-body');
  const ok    = status >= 200 && status < 300;
  badge.className = `status-badge ${ok ? 'ok' : 'err'}`;
  badge.textContent = status;
  body.innerHTML = hlJson(JSON.stringify(data, null, 2));
}

function toast(id, type, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `toast ${type} show`;
  el.textContent = (type === 'ok' ? '✓  ' : '✕  ') + msg;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 4500);
}

function setLoading(btn, on) {
  if (on) { btn._html = btn.innerHTML; btn.innerHTML = '<span class="spinner"></span>'; btn.disabled = true; }
  else    { btn.innerHTML = btn._html || btn.innerHTML; btn.disabled = false; }
}
