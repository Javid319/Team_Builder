import { useNavigate } from 'react-router-dom';
import { BrainCircuit, GitPullRequest, ArrowRight } from 'lucide-react';
import OnboardingLayout from '../../components/OnboardingLayout';

const VerifySkills = () => {
  const navigate = useNavigate();

  const handleAssessment = () => {
    localStorage.setItem('onboarding_step', 'assessment');
    navigate('/onboarding/assessment');
  };

  const handleResumeVerify = () => {
    localStorage.setItem('onboarding_step', 'resume_verify');
    navigate('/onboarding/resume');
  };

  return (
    <OnboardingLayout currentStep="verify">
      <div className="fade-in">
        {/* Workspace Header */}
        <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="badge badge-primary">Step 4 of 5</span>
            <span className="text-xs text-subtle">Verification Path Selection</span>
          </div>
          <h1 style={{ fontSize: '22px', marginBottom: '4px' }}>Select Verification Method</h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
            Choose how you would like to validate your claimed skills for hackathon team matching.
          </p>
        </div>

        {/* 2-Column Comparison Matrix */}
        <div className="grid-2 gap-6 items-start mb-6">
          
          {/* Method 1: AI Quiz */}
          <div className="card flex flex-col justify-between" style={{ minHeight: '380px' }}>
            <div>
              <div className="card-header">
                <div className="flex items-center gap-2">
                  <div style={{ padding: '8px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--primary)' }}>
                    <BrainCircuit size={18} />
                  </div>
                  <h3 className="card-title">AI Skill Assessment</h3>
                </div>
                <span className="badge badge-primary">Interactive</span>
              </div>

              <p style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '20px' }}>
                Evaluates your declared technologies via dynamic AI-generated code challenges, debugging tasks, and output predictions.
              </p>

              <div className="flex flex-col gap-2 mb-6 text-xs text-subtle">
                <div className="flex items-center justify-between" style={{ padding: '6px 10px', background: 'var(--surface-2)', borderRadius: '4px' }}>
                  <span>Evaluation Type</span>
                  <span className="text-text font-medium">Adaptive Quiz</span>
                </div>
                <div className="flex items-center justify-between" style={{ padding: '6px 10px', background: 'var(--surface-2)', borderRadius: '4px' }}>
                  <span>Est. Time</span>
                  <span className="text-text font-medium">3 - 5 Minutes</span>
                </div>
                <div className="flex items-center justify-between" style={{ padding: '6px 10px', background: 'var(--surface-2)', borderRadius: '4px' }}>
                  <span>Badge Issued</span>
                  <span className="badge badge-assessment">AI Assessed</span>
                </div>
              </div>
            </div>

            <button id="verify-start-assessment-btn" type="button" onClick={handleAssessment} className="btn btn-primary btn-full btn-lg">
              Take AI Quiz <ArrowRight size={14} />
            </button>
          </div>

          {/* Method 2: Resume + GitHub */}
          <div className="card flex flex-col justify-between" style={{ minHeight: '380px' }}>
            <div>
              <div className="card-header">
                <div className="flex items-center gap-2">
                  <div style={{ padding: '8px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '6px', color: '#818cf8' }}>
                    <GitPullRequest size={18} />
                  </div>
                  <h3 className="card-title">Resume & GitHub Inspector</h3>
                </div>
                <span className="badge badge-github">Automated</span>
              </div>

              <p style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '20px' }}>
                Runs background analysis on your uploaded PDF resume and public GitHub repositories to verify code commits & dependencies.
              </p>

              <div className="flex flex-col gap-2 mb-6 text-xs text-subtle">
                <div className="flex items-center justify-between" style={{ padding: '6px 10px', background: 'var(--surface-2)', borderRadius: '4px' }}>
                  <span>Evaluation Type</span>
                  <span className="text-text font-medium">Repo Background Check</span>
                </div>
                <div className="flex items-center justify-between" style={{ padding: '6px 10px', background: 'var(--surface-2)', borderRadius: '4px' }}>
                  <span>Est. Time</span>
                  <span className="text-text font-medium">Instant (~20s)</span>
                </div>
                <div className="flex items-center justify-between" style={{ padding: '6px 10px', background: 'var(--surface-2)', borderRadius: '4px' }}>
                  <span>Badge Issued</span>
                  <span className="badge badge-github">Code Verified</span>
                </div>
              </div>
            </div>

            <button id="verify-start-resume-btn" type="button" onClick={handleResumeVerify} className="btn btn-secondary btn-full btn-lg">
              Verify GitHub Repos <ArrowRight size={14} />
            </button>
          </div>

        </div>

      </div>
    </OnboardingLayout>
  );
};

export default VerifySkills;
