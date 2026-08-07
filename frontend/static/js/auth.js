// Redirect to app if already logged in
if (token.get()) window.location.href = '/app';

function switchTab(t) {
  document.getElementById('form-login').style.display    = t === 'login'    ? 'block' : 'none';
  document.getElementById('form-register').style.display = t === 'register' ? 'block' : 'none';
  document.getElementById('tab-login').classList.toggle('active',    t === 'login');
  document.getElementById('tab-register').classList.toggle('active', t === 'register');
}

// ── Login ──────────────────────────────────────
document.getElementById('btn-login').addEventListener('click', async () => {
  const btn   = document.getElementById('btn-login');
  const email = document.getElementById('l-email').value.trim();
  const pass  = document.getElementById('l-password').value;

  if (!email || !pass) return toast('login-toast', 'err', 'Email and password are required');

  setLoading(btn, true);
  const res = await Api.login({ email, password: pass });
  setLoading(btn, false);

  if (res.ok) {
    token.set(res.data.access_token);
    window.location.href = '/app';
  } else {
    toast('login-toast', 'err', res.data?.detail || 'Invalid email or password');
  }
});

// Enter key on password field
document.getElementById('l-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-login').click();
});

// ── Register ────────────────────────────────────
document.getElementById('btn-register').addEventListener('click', async () => {
  const btn   = document.getElementById('btn-register');
  const name  = document.getElementById('r-name').value.trim();
  const email = document.getElementById('r-email').value.trim();
  const pass  = document.getElementById('r-password').value;

  if (!email || !pass) return toast('register-toast', 'err', 'Email and password are required');
  if (pass.length < 8)  return toast('register-toast', 'err', 'Password must be at least 8 characters');

  setLoading(btn, true);
  const res = await Api.register({ email, password: pass, full_name: name || undefined });
  setLoading(btn, false);

  if (res.ok) {
    toast('register-toast', 'ok', 'Account created! Signing you in…');
    // Auto-login
    const loginRes = await Api.login({ email, password: pass });
    if (loginRes.ok) {
      token.set(loginRes.data.access_token);
      setTimeout(() => window.location.href = '/app', 800);
    }
  } else {
    toast('register-toast', 'err', res.data?.detail || 'Registration failed');
  }
});

document.getElementById('r-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-register').click();
});
