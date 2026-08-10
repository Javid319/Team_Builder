import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ProfileForm from './pages/ProfileForm';
import SkillAssessment from './pages/SkillAssessment';
import CollaborationAssessment from './pages/CollaborationAssessment';
import PersonalityAssessment from './pages/PersonalityAssessment';
import Onboarding from './pages/onboarding/Onboarding';
import OnboardingProfile from './pages/onboarding/OnboardingProfile';
import OnboardingSkills from './pages/onboarding/OnboardingSkills';
import VerifySkills from './pages/onboarding/VerifySkills';
import ResumeVerification from './pages/onboarding/ResumeVerification';
import OnboardingLayout from './components/OnboardingLayout';
import BrandLogo from './components/BrandLogo';
import { LogOut } from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────
const isLoggedIn = () => !!localStorage.getItem('access_token');
const onboardingDone = () => localStorage.getItem('onboarding_step') === 'complete';

// ── Guard: requires logged in + onboarding complete ──────────
const AppGuard = ({ children }: { children: React.ReactNode }) => {
  if (!isLoggedIn()) return <Navigate to="/" replace />;
  if (!onboardingDone()) {
    const step = localStorage.getItem('onboarding_step');
    switch (step) {
      case 'profile':     return <Navigate to="/onboarding/profile" replace />;
      case 'skills':      return <Navigate to="/onboarding/skills" replace />;
      case 'verify':      return <Navigate to="/onboarding/verify" replace />;
      case 'assessment':  return <Navigate to="/onboarding/assessment" replace />;
      case 'resume_verify': return <Navigate to="/onboarding/resume" replace />;
      default:            return <Navigate to="/onboarding/profile" replace />;
    }
  }
  return <>{children}</>;
};

// ── Guard: onboarding steps require login ────────────────────
const OnboardingStepGuard = ({ children }: { children: React.ReactNode }) => {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  if (onboardingDone()) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

// ── Onboarding assessment wrapper ────────────────────────────
const OnboardingAssessment = () => {
  const navigate = useNavigate();
  const handleComplete = () => {
    localStorage.setItem('onboarding_step', 'complete');
    localStorage.setItem('evaluation_method', 'assessment');
    navigate('/dashboard');
  };
  return (
    <OnboardingLayout currentStep="assessment">
      <SkillAssessment onComplete={handleComplete} />
    </OnboardingLayout>
  );
};

// ── Top navigation bar ────────────────────────────────────────
const Navigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem('access_token');

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login', { replace: true });
  };

  const isOnboarding = location.pathname.startsWith('/onboarding')
    || location.pathname === '/login'
    || location.pathname === '/register';

  if (!token || isOnboarding) return null;

  return (
    <nav className="navbar">
      <Link to="/dashboard" className="navbar-brand">
        <BrandLogo />
      </Link>
      <div className="nav-links">
        <Link to="/dashboard" className={`nav-link ${location.pathname === '/dashboard' ? 'active' : ''}`}>
          Dashboard
        </Link>
        <Link to="/profile" className={`nav-link ${location.pathname === '/profile' ? 'active' : ''}`}>
          Profile
        </Link>
        <button onClick={handleLogout} className="btn btn-ghost btn-sm" style={{ marginLeft: '8px' }}>
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </nav>
  );
};

function App() {
  return (
    <Router>
      <Navigation />
      <div className="container">
        <Routes>
          {/* ── Root — landing page for logged-out users ── */}
          <Route path="/" element={
            !isLoggedIn()
              ? <Home />
              : onboardingDone()
                ? <Navigate to="/dashboard" replace />
                : <Navigate to="/onboarding/profile" replace />
          } />

          {/* ── Landing / auth ── */}
          {/* Onboarding welcome — visible to everyone (no auth needed) */}
          <Route path="/onboarding" element={
            isLoggedIn() && onboardingDone()
              ? <Navigate to="/dashboard" replace />
              : <Onboarding />
          } />
          <Route path="/login" element={
            isLoggedIn() && onboardingDone()
              ? <Navigate to="/dashboard" replace />
              : <Login />
          } />
          <Route path="/register" element={
            isLoggedIn() && onboardingDone()
              ? <Navigate to="/dashboard" replace />
              : <Register />
          } />

          {/* ── Onboarding steps (require login, not complete) ── */}
          <Route path="/onboarding/profile" element={
            <OnboardingStepGuard><OnboardingProfile /></OnboardingStepGuard>
          } />
          <Route path="/onboarding/skills" element={
            <OnboardingStepGuard><OnboardingSkills /></OnboardingStepGuard>
          } />
          <Route path="/onboarding/verify" element={
            <OnboardingStepGuard><VerifySkills /></OnboardingStepGuard>
          } />
          <Route path="/onboarding/assessment" element={
            <OnboardingStepGuard><OnboardingAssessment /></OnboardingStepGuard>
          } />
          <Route path="/onboarding/resume" element={
            <OnboardingStepGuard><ResumeVerification /></OnboardingStepGuard>
          } />

          {/* ── App routes (require login + onboarding complete) ── */}
          <Route path="/dashboard" element={<AppGuard><Dashboard /></AppGuard>} />
          <Route path="/profile" element={<AppGuard><ProfileForm /></AppGuard>} />
          <Route path="/assessment" element={<AppGuard><SkillAssessment /></AppGuard>} />
          <Route path="/collaboration" element={<AppGuard><CollaborationAssessment /></AppGuard>} />
          <Route path="/personality" element={<AppGuard><PersonalityAssessment /></AppGuard>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
