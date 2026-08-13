import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { getHackathonById } from '../services/hackathonService';
import {
  allCandidateSkills,
  getCandidates,
  roleLabel,
  ROLES,
} from '../services/candidateService';
import type { CandidateProfile, CandidateRole } from '../types/candidate';
import type { Hackathon } from '../types/hackathon';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Filter,
  Loader2,
  PartyPopper,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';

const STEPS = ['Domain Interests', 'Blueprint Details', 'Team Structure', 'Review & Create'];
type Step = 1 | 2 | 3 | 4;

interface SlotDraft {
  id: string;
  role: string;
  skills: string[];
}

const toggleIn = <T,>(arr: T[], value: T): T[] =>
  arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

const Stepper = ({ current }: { current: Step }) => (
  <ol className="team-stepper">
    {STEPS.map((label, i) => {
      const n = (i + 1) as Step;
      const state = n < current ? 'done' : n === current ? 'active' : 'pending';
      return (
        <li key={label} className={`team-stepper-item is-${state}`}>
          <span className="team-stepper-dot">
            {state === 'done' ? <Check size={13} /> : n}
          </span>
          <span className="team-stepper-label">{label}</span>
        </li>
      );
    })}
  </ol>
);

const BlueprintCreatePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [hackathon, setHackathon] = useState<Hackathon | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [domains, setDomains] = useState<string[]>([]);

  // Step 2
  const [teamName, setTeamName] = useState('');
  const [teamDesc, setTeamDesc] = useState('');

  // Step 3
  const [slots, setSlots] = useState<SlotDraft[]>([]);
  const [allCandidates, setAllCandidates] = useState<CandidateProfile[]>([]);
  
  // Step 4
  const [createdBlueprint, setCreatedBlueprint] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const hack = await getHackathonById(id || '');
        if (cancelled) return;
        if (!hack) {
          setNotFound(true);
          return;
        }
        setHackathon(hack);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getCandidates();
        if (!cancelled) setAllCandidates(list);
      } catch {
        if (!cancelled) setAllCandidates([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const skillOptions = useMemo(() => allCandidateSkills(allCandidates), [allCandidates]);

  const addSlot = () => {
    setSlots((prev) => [...prev, { id: crypto.randomUUID(), role: ROLES[0], skills: [] }]);
  };

  const removeSlot = (idToRemove: string) => {
    setSlots((prev) => prev.filter(s => s.id !== idToRemove));
  };

  const updateSlot = (idToUpdate: string, updates: Partial<SlotDraft>) => {
    setSlots((prev) => prev.map(s => s.id === idToUpdate ? { ...s, ...updates } : s));
  };

  const toggleSkillInSlot = (slotId: string, skill: string) => {
    setSlots((prev) => prev.map(s => {
      if (s.id !== slotId) return s;
      return { ...s, skills: toggleIn(s.skills, skill) };
    }));
  };

  const canProceed = () => {
    if (step === 1) return domains.length > 0;
    if (step === 2) return teamName.trim().length > 0;
    if (step === 3) return slots.length > 0;
    return true;
  };

  const next = () => {
    if (!canProceed()) return;
    setStep((s) => Math.min(s + 1, 4) as Step);
  };

  const back = () => setStep((s) => Math.max(s - 1, 1) as Step);

  const handleCreate = async () => {
    if (!hackathon) return;
    setCreating(true);
    setCreateError('');
    try {
      const res = await api.createBlueprint({
        hackathon_id: hackathon.id,
        name: teamName.trim(),
        description: teamDesc.trim() || null,
        domains,
        slots: slots.map((s, idx) => ({ role: s.role, slot_order: idx, skills: s.skills })),
      });
      setCreatedBlueprint(res.data);
    } catch (err: any) {
      setCreateError(err.response?.data?.detail || 'Blueprint creation failed. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="main-workspace flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <Loader2 size={24} className="spin" color="var(--primary)" />
      </div>
    );
  }

  if (notFound || !hackathon) {
    return (
      <div className="main-workspace fade-in">
        <div className="hack-detail-notfound">
          <Building2 size={32} />
          <h1>Hackathon not found</h1>
          <p className="text-subtle">The hackathon you're looking for doesn't exist.</p>
          <Link to="/dashboard" className="btn btn-primary btn-sm"><ArrowLeft size={14} /> Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  if (createdBlueprint) {
    return (
      <div className="main-workspace fade-in">
        <div className="team-success">
          <div className="team-success-icon"><PartyPopper size={30} /></div>
          <h1>Blueprint Created!</h1>
          <p className="text-subtle">
            Your blueprint <strong>{createdBlueprint.name}</strong> is now OPEN and forming.
          </p>
          <div className="team-success-card">
            <div className="flex items-center gap-2 mb-2">
              <Users size={15} color="var(--primary)" />
              <h3 className="card-title">Slots ({createdBlueprint.slots.length})</h3>
            </div>
            <div className="team-success-members">
              {createdBlueprint.slots.map((s: any) => (
                <div key={s.id} className="team-success-member">
                  <span className="badge badge-neutral">{roleLabel(s.role)}</span>
                  <span>{s.preferred_skills.map((sk: any) => sk.name).join(', ')}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex wrap gap-2" style={{ marginTop: 20 }}>
            <Link to="/dashboard" className="btn btn-primary btn-sm"><ArrowRight size={14} /> Go to Dashboard</Link>
            <Link to={`/hackathons/${hackathon.id}`} className="btn btn-ghost btn-sm">View Hackathon</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-workspace fade-in">
      <Link to={`/hackathons/${hackathon.id}`} className="hack-detail-back">
        <ArrowLeft size={15} /> Back to Hackathon
      </Link>

      <div className="team-create-head">
        <div>
          <span className="badge badge-primary">Blueprint</span>
          <h1 className="team-create-title">Create Blueprint</h1>
          <p className="text-subtle">{hackathon.title}</p>
        </div>
        <Stepper current={step} />
      </div>

      {step === 1 && (
        <section className="team-panel">
          <h2 className="hack-detail-heading">Select Domain Interests</h2>
          <p className="hack-detail-lede">Choose which domains your blueprint will focus on.</p>
          <div className="team-domain-grid">
            {hackathon.domains.map((domain) => {
              const active = domains.includes(domain);
              return (
                <button
                  key={domain}
                  type="button"
                  className={`team-domain-card ${active ? 'is-active' : ''}`}
                  onClick={() => setDomains((prev) => toggleIn(prev, domain))}
                >
                  {active && <CheckCircle2 size={16} className="team-domain-check" />}
                  <Building2 size={18} />
                  <span>{domain}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="team-panel">
          <h2 className="hack-detail-heading">Blueprint Details</h2>
          <p className="hack-detail-lede">Give your blueprint a name and a description of your vision.</p>
          <div className="team-form">
            <label className="form-group">
              <span className="form-label">Blueprint name</span>
              <input
                className="form-control"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g. Next-Gen Financial App"
                maxLength={60}
              />
            </label>
            <label className="form-group">
              <span className="form-label">Description (optional)</span>
              <textarea
                className="form-control"
                rows={4}
                value={teamDesc}
                onChange={(e) => setTeamDesc(e.target.value)}
                placeholder="What is your team building? Roles you're looking for?"
                maxLength={500}
              />
            </label>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="team-panel">
          <div className="flex items-center justify-between" style={{ marginBottom: '1rem' }}>
             <div>
               <h2 className="hack-detail-heading" style={{ margin: 0 }}>Team Structure</h2>
               <p className="hack-detail-lede" style={{ margin: '4px 0 0 0' }}>Define the roles and skills you need to complete your team.</p>
             </div>
             <button type="button" className="btn btn-outline btn-sm" onClick={addSlot}>
               <Plus size={14} /> Add Slot
             </button>
          </div>

          {slots.length === 0 ? (
            <div className="hack-grid-empty">
              <Users size={26} />
              <p>No slots defined yet.</p>
              <button type="button" className="btn btn-primary btn-sm" onClick={addSlot}>
                Create first slot
              </button>
            </div>
          ) : (
            <div className="team-form" style={{ gap: '1.5rem' }}>
              {slots.map((slot, index) => (
                <div key={slot.id} className="team-review-block" style={{ position: 'relative', background: 'var(--surface)' }}>
                  <button 
                    type="button" 
                    className="btn btn-ghost btn-sm" 
                    style={{ position: 'absolute', top: 12, right: 12, color: 'var(--danger)' }}
                    onClick={() => removeSlot(slot.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                  <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Slot {index + 1}</h3>
                  <label className="form-group">
                    <span className="form-label">Role</span>
                    <select 
                      className="form-control" 
                      value={slot.role}
                      onChange={(e) => updateSlot(slot.id, { role: e.target.value as CandidateRole })}
                    >
                      {ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
                    </select>
                  </label>
                  <div className="form-group">
                    <span className="form-label">Preferred Skills</span>
                    <div className="team-filter-chips" style={{ maxHeight: '150px', overflowY: 'auto', padding: '4px' }}>
                      {skillOptions.map(skill => {
                        const active = slot.skills.includes(skill);
                        return (
                          <button
                            key={skill}
                            type="button"
                            className={`filter-chip ${active ? 'is-active' : ''}`}
                            onClick={() => toggleSkillInSlot(slot.id, skill)}
                          >
                            {active && <Check size={11} />} {skill}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {step === 4 && (
        <section className="team-panel">
          <h2 className="hack-detail-heading">Review &amp; Create Blueprint</h2>
          <p className="hack-detail-lede">Confirm the details before creating your blueprint.</p>
          <div className="team-review">
            <div className="team-review-block">
              <span className="team-review-label"><Building2 size={13} /> Hackathon</span>
              <span className="team-review-value">{hackathon.title}</span>
            </div>
            <div className="team-review-block">
              <span className="team-review-label"><Users size={13} /> Blueprint</span>
              <span className="team-review-value">{teamName}</span>
              {teamDesc && <span className="team-review-sub">{teamDesc}</span>}
            </div>
            <div className="team-review-block">
              <span className="team-review-label"><Filter size={13} /> Domains</span>
              <div className="flex wrap gap-2">
                {domains.map((d) => <span key={d} className="skill-tag">{d}</span>)}
              </div>
            </div>
            <div className="team-review-block">
              <span className="team-review-label"><Users size={13} /> Slots ({slots.length})</span>
              <div className="team-review-members">
                {slots.map((s, idx) => (
                  <div key={s.id} className="team-review-member">
                    <div className="team-review-member-info">
                      <span className="team-review-member-name">Slot {idx + 1}: {roleLabel(s.role)}</span>
                      <span className="team-review-member-role">{s.skills.join(', ')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="team-footer">
        {step > 1 && step < 4 ? (
          <button type="button" className="btn btn-ghost" onClick={back}>
            <ArrowLeft size={15} /> Back
          </button>
        ) : step === 4 ? (
          <button type="button" className="btn btn-ghost" onClick={back}>
            <ArrowLeft size={15} /> Back
          </button>
        ) : (
          <span />
        )}

        {step < 4 ? (
          <button type="button" className="btn btn-primary" onClick={next} disabled={!canProceed()}>
            Continue <ArrowRight size={15} />
          </button>
        ) : (
          <div className="flex items-center gap-3">
            {createError && <span className="text-danger text-sm">{createError}</span>}
            <button type="button" className="btn btn-primary" onClick={handleCreate} disabled={creating || slots.length === 0}>
              {creating ? <><Loader2 size={15} className="spin" /> Creating…</> : <>Create Blueprint</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BlueprintCreatePage;
