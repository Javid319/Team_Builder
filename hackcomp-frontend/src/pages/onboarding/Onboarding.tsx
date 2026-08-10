import { useNavigate } from 'react-router-dom';
import { ArrowRight, Zap, ShieldCheck, Code2, Terminal, CheckCircle } from 'lucide-react';
import OnboardingLayout from '../../components/OnboardingLayout';

const Onboarding = () => {
  const navigate = useNavigate();

  const handleContinue = () => {
    localStorage.setItem('onboarding_step', 'profile');
    navigate('/onboarding/profile');
  };

  return (
    <OnboardingLayout currentStep="welcome">
      <div className="fade-in">
        {/* Top Workspace Header */}
        <div style={{ marginBottom: '28px', paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="badge badge-primary">Developer Setup</span>
            <span className="text-xs text-subtle">Step 1 of 5</span>
          </div>
          <h1 style={{ fontSize: '24px', marginBottom: '6px' }}>Welcome to HackComp</h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)', maxWidth: '680px' }}>
            Set up your verified developer profile to showcase technical competency, validate code repositories with GitHub & AI, and get matched with top hackathon teams.
          </p>
        </div>

        {/* 2-Column Product Grid */}
        <div className="grid-2 gap-6 items-start mb-6">
          {/* Col 1: System Architecture Capabilities */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title flex items-center gap-2">
                <Terminal size={16} color="var(--primary)" /> Verification Pipeline
              </h3>
              <span className="badge badge-neutral">Core Features</span>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex gap-3 items-start">
                <div style={{ padding: '8px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--primary)' }}>
                  <Zap size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>AI-Powered Skill Parser</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                    Extract technical frameworks, languages, and project technologies from your PDF resume in seconds.
                  </div>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div style={{ padding: '8px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--success)' }}>
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>GitHub Repo Inspector</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                    Cross-reference claimed skills against real code, commit topics, and dependencies in public repositories.
                  </div>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div style={{ padding: '8px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '6px', color: '#a855f7' }}>
                  <Code2 size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>Dynamic Skill Badges</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                    Earn high-confidence badges and score cards for hackathon team matching.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Col 2: Onboarding Roadmap & CTA */}
          <div className="card flex flex-col justify-between" style={{ minHeight: '320px' }}>
            <div>
              <div className="card-header">
                <h3 className="card-title">Setup Roadmap</h3>
                <span className="badge badge-success flex items-center gap-1">
                  <CheckCircle size={12} /> Ready
                </span>
              </div>

              <div className="flex flex-col gap-3 mb-6">
                <div className="flex items-center justify-between" style={{ padding: '8px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '6px' }}>
                  <span className="text-xs font-medium text-text">1. Developer Profile</span>
                  <span className="text-xs text-subtle">Education & Links</span>
                </div>
                <div className="flex items-center justify-between" style={{ padding: '8px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '6px' }}>
                  <span className="text-xs font-medium text-text">2. Technical Skills</span>
                  <span className="text-xs text-subtle">Stack Declaration</span>
                </div>
                <div className="flex items-center justify-between" style={{ padding: '8px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '6px' }}>
                  <span className="text-xs font-medium text-text">3. Verification Method</span>
                  <span className="text-xs text-subtle">AI Quiz or GitHub</span>
                </div>
              </div>
            </div>

            <button
              id="start-onboarding-btn"
              onClick={handleContinue}
              className="btn btn-primary btn-full btn-lg"
            >
              Begin Profile Setup <ArrowRight size={15} />
            </button>
          </div>
        </div>

      </div>
    </OnboardingLayout>
  );
};

export default Onboarding;
