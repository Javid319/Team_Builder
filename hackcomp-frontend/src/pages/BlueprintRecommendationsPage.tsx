import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { api } from '../api';
import {
  ArrowLeft,
  Briefcase,
  ExternalLink,
  GraduationCap,
  Loader2,
  MapPin,
  Users,
  X,
} from 'lucide-react';
import { roleLabel, experienceLabel, commitmentLabel } from '../services/candidateService';
import { ToastBanner, useToast } from '../components/Toast';

interface SlotRecommendation {
  user_id: string;
  name: string;
  avatar_url?: string;
  college?: string;
  city?: string;
  github_url?: string;
  bio: string;
  role: string;
  skills: string[];
  experience_level: string;
  commitment_level: string;
  profile_strength: number;
  compatibility_score: number;
  skill_overlap: string[];
}

interface BlueprintSlotGroup {
  slot_id: string;
  slot_role: string;
  recommendations: SlotRecommendation[];
}

// ── Inline profile modal ──────────────────────────────────────
const ProfileModal = ({
  candidate,
  onClose,
}: {
  candidate: SlotRecommendation;
  onClose: () => void;
}) => (
  <div
    className="modal-overlay"
    role="dialog"
    aria-modal="true"
    aria-label={`${candidate.name}'s profile`}
    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.55)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}
  >
    <div
      className="team-panel fade-in"
      style={{ maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}
    >
      <button
        type="button"
        aria-label="Close profile"
        className="btn btn-ghost btn-sm"
        onClick={onClose}
        style={{ position: 'absolute', top: 12, right: 12 }}
      >
        <X size={16} />
      </button>

      {/* Header */}
      <div className="flex items-center gap-3" style={{ marginBottom: '1rem' }}>
        <div className="cand-avatar" style={{ width: 56, height: 56, flexShrink: 0 }}>
          {candidate.avatar_url
            ? <img src={candidate.avatar_url} alt={candidate.name} />
            : <Users size={22} />}
        </div>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>{candidate.name}</h2>
          <span className="cand-role">{roleLabel(candidate.role)}</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="badge badge-primary">{candidate.compatibility_score}% Match</span>
            <span className="badge badge-neutral">{experienceLabel(candidate.experience_level)}</span>
          </div>
        </div>
      </div>

      {/* Bio */}
      {candidate.bio && (
        <p className="text-subtle" style={{ marginBottom: '1rem' }}>{candidate.bio}</p>
      )}

      {/* Meta */}
      <div className="cand-meta" style={{ marginBottom: '1rem', flexWrap: 'wrap' }}>
        {candidate.college && <span><GraduationCap size={13} /> {candidate.college}</span>}
        {candidate.city && <span><MapPin size={13} /> {candidate.city}</span>}
        {candidate.commitment_level && (
          <span><Briefcase size={13} /> {commitmentLabel(candidate.commitment_level)}</span>
        )}
        {candidate.github_url && (
          <a href={candidate.github_url} target="_blank" rel="noreferrer" className="flex items-center gap-1">
            GitHub <ExternalLink size={11} />
          </a>
        )}
      </div>

      {/* Skills */}
      {candidate.skills.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <span className="form-label">Skills</span>
          <div className="cand-skills" style={{ marginTop: 6 }}>
            {candidate.skills.map((s) => {
              const isOverlap = candidate.skill_overlap.includes(s);
              return (
                <span key={s} className={`skill-tag ${isOverlap ? 'is-active' : ''}`}>{s}</span>
              );
            })}
          </div>
        </div>
      )}

      {/* Profile strength */}
      <div>
        <span className="form-label">Profile Strength</span>
        <div className="hack-detail-foryou-progress" style={{ marginTop: 6 }}>
          <div className="hack-detail-foryou-progress-track">
            <div
              className="hack-detail-foryou-progress-fill"
              style={{ width: `${candidate.profile_strength}%` }}
            />
          </div>
          <span className="hack-detail-foryou-progress-value">{candidate.profile_strength}%</span>
        </div>
      </div>
    </div>
  </div>
);

// ── Candidate card ────────────────────────────────────────────
const CandidateCard = ({
  candidate,
  onInvite,
  onViewProfile,
}: {
  candidate: SlotRecommendation;
  onInvite: (id: string) => void;
  onViewProfile: (candidate: SlotRecommendation) => void;
}) => (
  <article className="cand-card">
    <div className="cand-card-top">
      <div className="cand-avatar">
        {candidate.avatar_url ? (
          <img src={candidate.avatar_url} alt={candidate.name} loading="lazy" />
        ) : (
          <Users size={18} />
        )}
      </div>
      <div className="cand-identity">
        <h3 className="cand-name">{candidate.name}</h3>
        <span className="cand-role">{roleLabel(candidate.role)}</span>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="badge badge-primary">{candidate.compatibility_score}% Match</span>
        <span className="badge badge-neutral cand-exp">{experienceLabel(candidate.experience_level)}</span>
      </div>
    </div>

    <p className="cand-bio">{candidate.bio}</p>

    <div className="cand-meta">
      {candidate.college && <span><GraduationCap size={12} /> {candidate.college}</span>}
      {candidate.city && <span><MapPin size={12} /> {candidate.city}</span>}
      {candidate.github_url && (
        <a href={candidate.github_url} target="_blank" rel="noreferrer">
          GitHub <ExternalLink size={11} />
        </a>
      )}
    </div>

    <div className="cand-skills">
      {candidate.skills.slice(0, 6).map((s) => {
        const isOverlap = candidate.skill_overlap.includes(s);
        return (
          <span key={s} className={`skill-tag ${isOverlap ? 'is-active' : ''}`}>{s}</span>
        );
      })}
    </div>

    <div className="cand-avail" style={{ marginTop: '1rem', display: 'flex', gap: '10px', fontSize: '0.8rem', color: 'var(--text-subtle)' }}>
      <span><Briefcase size={12} /> {commitmentLabel(candidate.commitment_level) || 'Flexible'}</span>
    </div>

    <div className="flex gap-2 mt-4">
      <button
        type="button"
        className="btn btn-sm btn-outline flex-1"
        onClick={() => onViewProfile(candidate)}
      >
        View Profile
      </button>
      <button
        type="button"
        className="btn btn-sm btn-primary flex-1"
        onClick={() => onInvite(candidate.user_id)}
      >
        Invite
      </button>
    </div>
  </article>
);

// ── Page ──────────────────────────────────────────────────────
const BlueprintRecommendationsPage = () => {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [slotGroups, setSlotGroups] = useState<BlueprintSlotGroup[]>([]);
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);
  const [profileCandidate, setProfileCandidate] = useState<SlotRecommendation | null>(null);
  const [toast, showToast] = useToast();

  useEffect(() => {
    let cancelled = false;
    api
      .getBlueprintRecommendations(id!)
      .then((res) => {
        if (!cancelled) setSlotGroups(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.detail || 'Failed to load recommendations');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  const handleInvite = async (userId: string, slotId: string) => {
    try {
      await api.inviteToBlueprint(id!, { receiver_id: userId, slot_id: slotId });
      showToast('Invitation sent successfully!', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to send invitation');
    }
  };

  if (loading) {
    return (
      <div className="main-workspace flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <Loader2 size={24} className="spin" color="var(--primary)" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="main-workspace fade-in">
        <div className="hack-detail-notfound">
          <Users size={32} />
          <h1>Cannot load recommendations</h1>
          <p className="text-subtle">{error}</p>
          <Link to="/dashboard" className="btn btn-primary btn-sm">
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="main-workspace fade-in">
      <ToastBanner toast={toast} />

      {profileCandidate && createPortal(
        <ProfileModal
          candidate={profileCandidate}
          onClose={() => setProfileCandidate(null)}
        />,
        document.body
      )}

      <Link to={`/blueprints/${id}/dashboard`} className="hack-detail-back">
        <ArrowLeft size={15} /> Back to Dashboard
      </Link>

      <div className="team-create-head">
        <div>
          <span className="badge badge-primary">AI Matching</span>
          <h1 className="team-create-title">Slot Recommendations</h1>
          <p className="text-subtle">Top candidates tailor-matched for each open slot in your blueprint.</p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {slotGroups.length === 0 ? (
          <div className="hack-grid-empty">
            <Users size={26} />
            <p>No open slots to recommend for.</p>
          </div>
        ) : (
          <>
            <div className="flex gap-4 justify-center mb-2">
              {slotGroups.map((group, index) => (
                <button
                  key={group.slot_id}
                  onClick={() => setActiveSlotIndex(index)}
                  title={roleLabel(group.slot_role)}
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    border: activeSlotIndex === index ? 'none' : '1px solid var(--border)',
                    background: activeSlotIndex === index ? 'var(--primary)' : 'var(--surface)',
                    color: activeSlotIndex === index ? '#fff' : 'var(--text-subtle)',
                    transition: 'all 0.2s',
                    fontSize: '1rem',
                  }}
                >
                  {index + 1}
                </button>
              ))}
            </div>

            {slotGroups[activeSlotIndex] && (
              <section className="team-panel fade-in">
                <h2 className="hack-detail-heading text-center" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                  {roleLabel(slotGroups[activeSlotIndex].slot_role)}
                </h2>
                <div className="cand-grid">
                  {slotGroups[activeSlotIndex].recommendations.length === 0 ? (
                    <p className="text-subtle" style={{ gridColumn: '1 / -1', textAlign: 'center' }}>No eligible candidates found for this slot.</p>
                  ) : (
                    slotGroups[activeSlotIndex].recommendations.map((cand) => (
                      <CandidateCard
                        key={cand.user_id}
                        candidate={cand}
                        onInvite={(userId) => handleInvite(userId, slotGroups[activeSlotIndex].slot_id)}
                        onViewProfile={setProfileCandidate}
                      />
                    ))
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BlueprintRecommendationsPage;
