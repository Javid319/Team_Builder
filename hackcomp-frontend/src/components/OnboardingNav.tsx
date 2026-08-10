import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, LogOut } from 'lucide-react';
import BrandLogo from './BrandLogo';

interface OnboardingNavProps {
  currentStep: 'welcome' | 'profile' | 'skills' | 'verify' | 'assessment' | 'resume_verify';
}

const STEPS = [
  { id: 'welcome',       label: 'Welcome',    num: 1 },
  { id: 'profile',       label: 'Profile',    num: 2 },
  { id: 'skills',        label: 'Skills',     num: 3 },
  { id: 'verify',        label: 'Verify',     num: 4 },
  { id: 'assessment',    label: 'Assessment', num: 5 },
  { id: 'resume_verify', label: 'Resume',     num: 5 },
];

const DISPLAY_STEPS = STEPS.filter(s => s.id !== 'resume_verify');

const OnboardingNav: React.FC<OnboardingNavProps> = ({ currentStep }) => {
  const navigate = useNavigate();
  const currentIdx = STEPS.findIndex(s => s.id === currentStep);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div style={{ width: '100%', borderBottom: '1px solid var(--border)', background: 'var(--bg)', padding: '0 24px', marginBottom: '40px' }}>
      <div style={{ height: '57px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '1100px', margin: '0 auto' }}>
        <div className="navbar-brand">
          <BrandLogo />
        </div>
        <button onClick={handleLogout} className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <LogOut size={14} /> Sign out
        </button>
      </div>
      <div style={{ paddingBottom: '20px', maxWidth: '560px', margin: '0 auto' }}>
        <div className="step-bar" style={{ margin: 0 }}>
          {DISPLAY_STEPS.map((step) => {
            const isActive = step.id === currentStep || (currentStep === 'resume_verify' && step.id === 'verify');
            const stepCompleted = currentIdx > STEPS.findIndex(s => s.id === step.id);
            const state = stepCompleted ? 'completed' : isActive ? 'active' : '';
            return (
              <div key={step.id} className={`step-item ${state}`}>
                <div className="step-dot">
                  {stepCompleted ? <Check size={12} /> : step.num}
                </div>
                <span className="step-label">{step.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default OnboardingNav;
