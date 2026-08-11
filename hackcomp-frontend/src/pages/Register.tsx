import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { Loader2 } from 'lucide-react';
import BrandLogo from '../components/BrandLogo';

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.register({ email, password, full_name: fullName });
      const loginRes = await api.login({ email, password });
      if (loginRes.data.access_token) {
        localStorage.setItem('access_token', loginRes.data.access_token);
        localStorage.setItem('onboarding_step', 'profile');
        navigate('/onboarding/profile');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-center fade-in">
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div className="flex items-center mb-6" style={{ justifyContent: 'center' }}>
          <BrandLogo size={28} />
        </div>

        <div className="card">
          <h2 style={{ fontSize: '18px', marginBottom: '4px' }}>Create an account</h2>
          <p style={{ fontSize: '13px', marginBottom: '24px', color: 'var(--muted)' }}>
            Get started with AI-driven skill evaluation
          </p>

          {error && <div className="alert alert-danger mb-4">{error}</div>}

          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                id="register-fullname"
                type="text"
                required
                className="form-control"
                placeholder="Alex Morgan"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                id="register-email"
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
                id="register-password"
                type="password"
                required
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            <button id="register-submit" type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
              {loading ? <><Loader2 size={15} className="spin" /> Creating account...</> : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center mt-4" style={{ fontSize: '13px' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--primary)' }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
