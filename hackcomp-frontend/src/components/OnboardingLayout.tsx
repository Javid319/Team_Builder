import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, LogOut, Shield } from 'lucide-react';
import BrandLogo from './BrandLogo';

interface OnboardingLayoutProps {
  currentStep: 'welcome' | 'profile' | 'skills' | 'verify' | 'assessment' | 'resume_verify';
  children: React.ReactNode;
}

const STEPS = [
  { id: 'welcome',       label: '1. Welcome',       title: 'Overview',      desc: 'Hackathon platform context' },
  { id: 'profile',       label: '2. Profile',       title: 'Developer Info',desc: 'Education & social links' },
  { id: 'skills',        label: '3. Skills',        title: 'Tech Stack',    desc: 'Declare known technologies' },
  { id: 'verify',        label: '4. Verify',        title: 'Validation',    desc: 'Select verification path' },
  { id: 'assessment',    label: '5. Assessment',    title: 'Evaluation',    desc: 'AI test or GitHub check' },
];

const OnboardingLayout: React.FC<OnboardingLayoutProps> = ({ currentStep, children }) => {
  const navigate = useNavigate();
  const currentIdx = STEPS.findIndex(s => s.id === (currentStep === 'resume_verify' ? 'assessment' : currentStep));

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      {/* ── Left Sidebar (280px) ── */}
      <aside className="sidebar-panel">
        <div>
          {/* Brand */}
          <div className="flex items-center justify-between" style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
            <div className="navbar-brand">
              <BrandLogo size={22} />
            </div>
            <span className="badge badge-neutral" style={{ fontSize: '10px' }}>v1.0</span>
          </div>

          {/* Step Progress */}
          <div className="sidebar-steps">
            {STEPS.map((step, idx) => {
              const isActive = step.id === currentStep || (currentStep === 'resume_verify' && step.id === 'assessment');
              const isCompleted = currentIdx > idx;
              const stateClass = isCompleted ? 'completed' : isActive ? 'active' : '';
              return (
                <div key={step.id} className={`sidebar-step-item ${stateClass}`}>
                  <div className="sidebar-step-num">
                    {isCompleted ? <Check size={11} /> : idx + 1}
                  </div>
                  <div>
                    <div className="sidebar-step-title">{step.title}</div>
                    <div className="sidebar-step-desc">{step.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar Footer */}
        <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
          <div className="card card-sm mb-3" style={{ background: 'var(--surface-2)' }}>
            <div className="flex items-center gap-2 text-xs text-subtle">
              <Shield size={13} color="var(--primary)" />
              <span>Skill Verification Active</span>
            </div>
          </div>

          <button onClick={handleLogout} className="btn btn-ghost btn-sm w-full justify-between">
            <span className="text-xs text-subtle">Sign out account</span>
            <LogOut size={13} />
          </button>
        </div>
      </aside>

      {/* ── Main Content Workspace ── */}
      <main className="content-panel">
        {children}
      </main>
    </div>
  );
};

export default OnboardingLayout;
