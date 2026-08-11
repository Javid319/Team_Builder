import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { Loader2 } from 'lucide-react';
import BrandLogo from '../components/BrandLogo';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.login({ email, password });
      if (res.data.access_token) {
        localStorage.setItem('access_token', res.data.access_token);
        const [profileRes, skillsRes] = await Promise.all([
          api.getProfile().catch(() => ({ data: null })),
          api.getSkills().catch(() => ({ data: [] })),
        ]);
        const hasProfile = !!profileRes.data?.id;
        const hasSkills = Array.isArray(skillsRes.data) && skillsRes.data.length > 0;

        if (hasProfile && hasSkills) {
          localStorage.setItem('onboarding_step', 'complete');
          navigate('/dashboard');
          return;
        }

        localStorage.setItem('onboarding_step', hasProfile ? 'skills' : 'profile');
        navigate(hasProfile ? '/onboarding/skills' : '/onboarding/profile');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-center fade-in">
      <div style={{ width: '100%', maxWidth: '380px' }}>
        {/* Logo */}
        <div className="flex items-center mb-6" style={{ justifyContent: 'center' }}>
          <BrandLogo size={28} />
        </div>

        <div className="card">
          <h2 style={{ fontSize: '18px', marginBottom: '4px' }}>Sign in</h2>
          <p style={{ fontSize: '13px', marginBottom: '24px', color: 'var(--muted)' }}>
            Enter your credentials to continue
          </p>

          {error && (
            <div className="alert alert-danger mb-4">{error}</div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                id="login-email"
                type="email"
                required
                className="form-control"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">Password</label>
              <input
                id="login-password"
                type="password"
                required
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            <button id="login-submit" type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
              {loading ? <><Loader2 size={15} className="spin" /> Signing in...</> : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center mt-4" style={{ fontSize: '13px' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: 'var(--primary)' }}>Create one</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;

