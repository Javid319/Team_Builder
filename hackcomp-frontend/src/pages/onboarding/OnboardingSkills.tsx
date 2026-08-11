import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import SkillsManager from '../../components/SkillsManager';
import { ArrowRight, Code, Plus, Check } from 'lucide-react';
import OnboardingLayout from '../../components/OnboardingLayout';

const PRESET_SKILLS = [
  'Python', 'TypeScript', 'React', 'FastAPI', 
  'Node.js', 'PostgreSQL', 'Docker', 'AWS', 
  'PyTorch', 'Next.js', 'Tailwind', 'Git'
];

const OnboardingSkills = () => {
  const navigate = useNavigate();
  const [skillCount, setSkillCount] = useState(0);
  const [existingSkillNames, setExistingSkillNames] = useState<Set<string>>(new Set());

  const checkSkillCount = async () => {
    try {
      const res = await api.getSkills();
      if (Array.isArray(res.data)) {
        setSkillCount(res.data.length);
        setExistingSkillNames(new Set(res.data.map((s: any) => s.name.toLowerCase())));
      }
    } catch {
      setSkillCount(0);
    }
  };

  useEffect(() => {
    const processAutofill = async () => {
      const autofill = sessionStorage.getItem('autofill_skills');
      if (autofill) {
        try {
          const skillsList = JSON.parse(autofill);
          for (const s of skillsList) {
            try {
               await api.addSkill({ name: s, level: 'intermediate' });
            } catch (e) {}
          }
        } catch (e) {}
        sessionStorage.removeItem('autofill_skills');
        checkSkillCount();
      }
    };
    processAutofill();
  }, []);

  useEffect(() => {
    checkSkillCount();
    const interval = setInterval(checkSkillCount, 1500);
    return () => clearInterval(interval);
  }, []);

  const handleQuickAdd = async (skillName: string) => {
    try {
      await api.addSkill({ name: skillName, level: 'intermediate' });
      checkSkillCount();
    } catch (e) {}
  };

  const handleContinue = () => {
    localStorage.setItem('onboarding_step', 'complete');
    navigate('/dashboard');
  };

  return (
    <OnboardingLayout currentStep="skills">
      <div className="fade-in">
        {/* Workspace Header */}
        <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="badge badge-primary">Step 2 of 2</span>
            <span className="text-xs text-subtle">Technology Stack</span>
          </div>
          <h1 style={{ fontSize: '22px', marginBottom: '4px' }}>Add Technical Skills</h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
            Declare languages, frameworks, databases, and DevOps tools you have built projects with.
          </p>
        </div>

        <div className="grid-sidebar gap-6 items-start mb-6">
          {/* Main Skills Manager (Left 65%) */}
          <div>
            <SkillsManager />

            <div className="mt-6">
              {skillCount > 0 ? (
                <button
                  id="onboarding-verify-skills-btn"
                  onClick={handleContinue}
                  className="btn btn-primary btn-full btn-lg"
                >
                  Save & Go to Dashboard ({skillCount} skills added) <ArrowRight size={15} />
                </button>
              ) : (
                <div className="alert alert-warning text-center justify-center">
                  Add at least one skill to continue to your dashboard
                </div>
              )}
            </div>
          </div>

          {/* Quick-Add Presets Panel (Right 35%) */}
          <div className="flex flex-col gap-4">
            <div className="card">
              <div className="card-header">
                <h3 className="card-title flex items-center gap-2">
                  <Code size={15} color="var(--primary)" /> Popular Presets
                </h3>
                <span className="badge badge-neutral">Quick Add</span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '14px' }}>
                Click any common technology below to instantly attach it to your profile:
              </p>

              <div className="flex wrap gap-2">
                {PRESET_SKILLS.map((preset) => {
                  const added = existingSkillNames.has(preset.toLowerCase());
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => !added && handleQuickAdd(preset)}
                      disabled={added}
                      className={`btn btn-sm ${added ? 'btn-ghost' : 'btn-secondary'}`}
                      style={{ fontSize: '11px', padding: '3px 8px' }}
                    >
                      {added ? <Check size={11} color="var(--success)" /> : <Plus size={11} />}
                      {preset}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="card card-sm">
              <div className="text-xs font-semibold text-text mb-2">Why declare skills?</div>
              <div className="text-xs text-subtle" style={{ lineHeight: 1.5 }}>
                Verified skills act as trusted proof of competency for hackathon organizers and potential project partners.
              </div>
            </div>
          </div>
        </div>

      </div>
    </OnboardingLayout>
  );
};

export default OnboardingSkills;
