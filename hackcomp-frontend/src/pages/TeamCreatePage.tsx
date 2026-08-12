import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getHackathonById } from '../services/hackathonService';
import {
  allCandidateSkills,
  COMMITMENT_LEVELS,
  commitmentLabel,
  EXPERIENCE_LEVELS,
  experienceLabel,
  getCandidates,
  roleLabel,
  ROLES,
} from '../services/candidateService';
import type {
  CandidateExperience,
  CandidateFilters,
  CandidateProfile,
  CandidateRole,
  CommitmentLevel,
  CreatedTeam,
} from '../types/candidate';
import type { Hackathon } from '../types/hackathon';
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  GraduationCap,
  Loader2,
  MapPin,
  PartyPopper,
  Search,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

const STEPS = ['Domain Interests', 'Team Details', 'Browse Candidates', 'Review & Create'];
type Step = 1 | 2 | 3 | 4;

const emptyFilters = (): CandidateFilters => ({
  search: '',
  roles: [],
  skills: [],
  experience: [],
  availability: [],
});

const toggleIn = <T,>(arr: T[], value: T): T[] =>
  arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

const uid = () => `team_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// ── Stepper ───────────────────────────────────────────────────
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

// ── Reusable filter chip group ────────────────────────────────
const FilterGroup = ({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) => (
  <div className="team-filter-group">
    <span className="team-filter-label">{label}</span>
    <div className="team-filter-chips">
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            className={`filter-chip ${active ? 'is-active' : ''}`}
            onClick={() => onToggle(opt)}
          >
            {active && <Check size={11} />} {opt}
          </button>
        );
      })}
    </div>
  </div>
);

// ── Candidate card ────────────────────────────────────────────
const CandidateCard = ({
  candidate,
  invited,
  onToggleInvite,
}: {
  candidate: CandidateProfile;
  invited: boolean;
  onToggleInvite: (id: string) => void;
}) => {
  const data = candidate.profile_data;
  const tzCity = data.availability.timezone.split('/').pop() || data.availability.timezone;

  return (
    <article className={`cand-card ${invited ? 'is-invited' : ''}`}>
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
          <span className="cand-role">{roleLabel(data.role.role)}</span>
        </div>
        <span className="badge badge-neutral cand-exp">{experienceLabel(data.experience.level)}</span>
      </div>

      <p className="cand-bio">{candidate.bio}</p>

      <div className="cand-meta">
        {candidate.college && (
          <span><GraduationCap size={12} /> {candidate.college}</span>
        )}
        {candidate.city && (
          <span><MapPin size={12} /> {candidate.city}</span>
        )}
        {candidate.github_url && (
          <a href={candidate.github_url} target="_blank" rel="noreferrer">
            GitHub <ExternalLink size={11} />
          </a>
        )}
      </div>

      <div className="cand-skills">
        {data.ability.skills.slice(0, 6).map((s) => (
          <span key={s.name} className="skill-tag">{s.name}</span>
        ))}
      </div>

      <div className="cand-avail">
        <span><CalendarDays size={12} /> {data.availability.working_days.join(', ') || 'Flexible'}</span>
        <span><Clock size={12} /> {data.availability.working_hours} · {tzCity}</span>
        <span><Briefcase size={12} /> {commitmentLabel(data.availability.commitment_level)}</span>
      </div>

      <button
        type="button"
        className={`btn btn-sm btn-full ${invited ? 'btn-ghost cand-invited' : 'btn-outline'}`}
        onClick={() => onToggleInvite(candidate.id)}
      >
        {invited ? <><UserCheck size={13} /> Invited</> : <><UserPlus size={13} /> Invite</>}
      </button>
    </article>
  );
};

// ── Page ──────────────────────────────────────────────────────
const TeamCreatePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [hackathon, setHackathon] = useState<Hackathon | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState<Step>(1);

  // Step 1 — domain interests
  const [domains, setDomains] = useState<string[]>([]);

  // Step 2 — team details
  const [teamName, setTeamName] = useState('');
  const [teamSize, setTeamSize] = useState<number | ''>('');
  const [teamDesc, setTeamDesc] = useState('');

  // Step 3 — browse candidates
  const [candidates, setCandidates] = useState<CandidateProfile[]>([]);
  const [allCandidates, setAllCandidates] = useState<CandidateProfile[]>([]);
  const [invited, setInvited] = useState<string[]>([]);
  const [filters, setFilters] = useState<CandidateFilters>(emptyFilters());

  // Step 4 — create
  const [createdTeam, setCreatedTeam] = useState<CreatedTeam | null>(null);
  const [creating, setCreating] = useState(false);

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

  // The full unfiltered list only feeds the skill filter options.
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

  // Server-side filtering — single source of truth for the displayed list.
  // Debounce so typing in the search box doesn't hammer the API. A request id
  // guard ensures a slow earlier response can never overwrite a newer filter.
  const requestIdRef = useRef(0);
  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const timer = setTimeout(async () => {
      try {
        const list = await getCandidates(filters);
        if (requestIdRef.current === requestId) setCandidates(list);
      } catch {
        if (requestIdRef.current === requestId) setCandidates([]);
      }
    }, 300);
    return () => { clearTimeout(timer); };
  }, [filters]);

  useEffect(() => {
    if (hackathon && teamSize === '') {
      setTeamSize(hackathon.team_size.min);
    }
  }, [hackathon, teamSize]);

  const skillOptions = useMemo(() => allCandidateSkills(allCandidates), [allCandidates]);
  const filtered = candidates;
  const invitedCandidates = useMemo(
    () => allCandidates.filter((c) => invited.includes(c.id)),
    [allCandidates, invited],
  );

  const minSize = hackathon?.team_size.min ?? 1;
  const maxSize = hackathon?.team_size.max ?? 5;

  const canProceed = () => {
    if (step === 1) return domains.length > 0;
    if (step === 2) {
      const size = Number(teamSize);
      return teamName.trim().length > 0 && size >= minSize && size <= maxSize;
    }
    if (step === 3) return invited.length > 0;
    return true;
  };

  const next = () => {
    if (!canProceed()) return;
    setStep((s) => Math.min(s + 1, 4) as Step);
  };

  const back = () => setStep((s) => Math.max(s - 1, 1) as Step);

  const clearFilters = () => setFilters(emptyFilters());

  const handleCreate = () => {
    if (!hackathon) return;
    setCreating(true);
    const team: CreatedTeam = {
      id: uid(),
      hackathon_id: hackathon.id,
      hackathon_title: hackathon.title,
      name: teamName.trim(),
      size: Number(teamSize),
      domains,
      description: teamDesc.trim(),
      members: invitedCandidates.map((c) => ({
        id: c.id,
        name: c.name,
        role: c.profile_data.role.role,
        skills: c.profile_data.ability.skills.map((s) => s.name),
        commitment_level: c.profile_data.availability.commitment_level,
      })),
      created_at: new Date().toISOString(),
    };
    setTimeout(() => {
      const existing = JSON.parse(localStorage.getItem('hackcomp_teams') || '[]') as CreatedTeam[];
      localStorage.setItem('hackcomp_teams', JSON.stringify([...existing, team]));
      setCreatedTeam(team);
      setCreating(false);
    }, 600);
  };

  // ── Loading / not-found ──
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
          <CalendarDays size={32} />
          <h1>Hackathon not found</h1>
          <p className="text-subtle">The hackathon you're looking for doesn't exist.</p>
          <Link to="/dashboard" className="btn btn-primary btn-sm"><ArrowLeft size={14} /> Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  // ── Success screen ──
  if (createdTeam) {
    return (
      <div className="main-workspace fade-in">
        <div className="team-success">
          <div className="team-success-icon"><PartyPopper size={30} /></div>
          <h1>Team created!</h1>
          <p className="text-subtle">
            Your team <strong>{createdTeam.name}</strong> is ready for <strong>{createdTeam.hackathon_title}</strong>.
          </p>

          <div className="team-success-card">
            <div className="flex items-center gap-2 mb-2">
              <Users size={15} color="var(--primary)" />
              <h3 className="card-title">Team members ({createdTeam.members.length})</h3>
            </div>
            <div className="team-success-members">
              {createdTeam.members.map((m) => (
                <div key={m.id} className="team-success-member">
                  <span className="badge badge-neutral">{roleLabel(m.role)}</span>
                  <span>{m.name}</span>
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

  // ── Wizard ──
  return (
    <div className="main-workspace fade-in">
      <Link to={`/hackathons/${hackathon.id}`} className="hack-detail-back">
        <ArrowLeft size={15} /> Back to Hackathon
      </Link>

      <div className="team-create-head">
        <div>
          <span className="badge badge-primary">{hackathon.mode}</span>
          <h1 className="team-create-title">Create Team (Regular)</h1>
          <p className="text-subtle">{hackathon.title}</p>
        </div>
        <Stepper current={step} />
      </div>

      {/* ── Step 1: Domain interests ── */}
      {step === 1 && (
        <section className="team-panel">
          <h2 className="hack-detail-heading">Select Domain Interests</h2>
          <p className="hack-detail-lede">Choose which domains your team will focus on. This shapes who you look for.</p>
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

      {/* ── Step 2: Team details ── */}
      {step === 2 && (
        <section className="team-panel">
          <h2 className="hack-detail-heading">Team Details</h2>
          <p className="hack-detail-lede">Give your team a name and decide its size (hackathon allows {minSize}-{maxSize}).</p>
          <div className="team-form">
            <label className="form-group">
              <span className="form-label">Team name</span>
              <input
                className="form-control"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g. Byte Brigade"
                maxLength={60}
              />
            </label>

            <label className="form-group">
              <span className="form-label">Team size (max {maxSize})</span>
              <input
                className="form-control"
                type="number"
                min={minSize}
                max={maxSize}
                value={teamSize}
                onChange={(e) => setTeamSize(e.target.value === '' ? '' : Number(e.target.value))}
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

      {/* ── Step 3: Browse candidates ── */}
      {step === 3 && (
        <div className="team-browse">
          <aside className="team-filters">
            <div className="team-filters-head">
              <span className="team-filters-title"><Filter size={14} /> Filters</span>
              <button type="button" className="team-filters-clear" onClick={clearFilters}>Clear all</button>
            </div>

            <label className="team-search">
              <Search size={14} />
              <input
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                placeholder="Search name, skill, college…"
              />
            </label>

            <FilterGroup
              label="Role"
              options={ROLES.map(roleLabel)}
              selected={filters.roles.map(roleLabel)}
              onToggle={(value) => {
                const raw = (ROLES.find((r) => roleLabel(r) === value) || value) as CandidateRole;
                setFilters((f) => ({ ...f, roles: toggleIn(f.roles, raw) }));
              }}
            />

            <FilterGroup
              label="Skills"
              options={skillOptions.slice(0, 18)}
              selected={filters.skills}
              onToggle={(value) => setFilters((f) => ({ ...f, skills: toggleIn(f.skills, value) }))}
            />

            <FilterGroup
              label="Experience"
              options={EXPERIENCE_LEVELS.map(experienceLabel)}
              selected={filters.experience.map(experienceLabel)}
              onToggle={(value) => {
                const raw = (EXPERIENCE_LEVELS.find((l) => experienceLabel(l) === value) ||
                  value) as CandidateExperience;
                setFilters((f) => ({ ...f, experience: toggleIn(f.experience, raw) }));
              }}
            />

            <FilterGroup
              label="Availability"
              options={COMMITMENT_LEVELS.map(commitmentLabel)}
              selected={filters.availability.map(commitmentLabel)}
              onToggle={(value) => {
                const raw = (COMMITMENT_LEVELS.find((c) => commitmentLabel(c) === value) ||
                  value) as CommitmentLevel;
                setFilters((f) => ({ ...f, availability: toggleIn(f.availability, raw) }));
              }}
            />
          </aside>

          <div className="team-candidates">
            <div className="team-candidates-head">
              <span className="text-subtle">{filtered.length} candidate{filtered.length === 1 ? '' : 's'}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setInvited([])}>
                <X size={13} /> Clear invites
              </button>
            </div>

            {filtered.length === 0 ? (
              <div className="hack-grid-empty">
                <Search size={26} />
                <p>No candidates match your filters. Try widening your search.</p>
                <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>Clear all filters</button>
              </div>
            ) : (
              <div className="cand-grid">
                {filtered.map((candidate) => (
                  <CandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    invited={invited.includes(candidate.id)}
                    onToggleInvite={(cid) => setInvited((prev) => toggleIn(prev, cid))}
                  />
                ))}
              </div>
            )}

            {invited.length > 0 && (
              <div className="team-invite-bar">
                <span className="team-invite-count">
                  <UserCheck size={14} /> {invited.length} invited
                </span>
                <button type="button" className="btn btn-primary btn-sm" onClick={next}>
                  Continue to Review <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Step 4: Review & create ── */}
      {step === 4 && (
        <section className="team-panel">
          <h2 className="hack-detail-heading">Review &amp; Create Team</h2>
          <p className="hack-detail-lede">Confirm the details before creating your team.</p>

          <div className="team-review">
            <div className="team-review-block">
              <span className="team-review-label"><Building2 size={13} /> Hackathon</span>
              <span className="team-review-value">{hackathon.title}</span>
            </div>

            <div className="team-review-block">
              <span className="team-review-label"><Users size={13} /> Team</span>
              <span className="team-review-value">{teamName} · {teamSize} members</span>
              {teamDesc && <span className="team-review-sub">{teamDesc}</span>}
            </div>

            <div className="team-review-block">
              <span className="team-review-label"><Filter size={13} /> Domains</span>
              <div className="flex wrap gap-2">
                {domains.map((d) => <span key={d} className="skill-tag">{d}</span>)}
              </div>
            </div>

            <div className="team-review-block">
              <span className="team-review-label"><UserCheck size={13} /> Invited members ({invitedCandidates.length})</span>
              <div className="team-review-members">
                {invitedCandidates.map((c) => (
                  <div key={c.id} className="team-review-member">
                    <div className="cand-avatar cand-avatar-sm">
                      {c.avatar_url ? <img src={c.avatar_url} alt={c.name} /> : <Users size={14} />}
                    </div>
                    <div className="team-review-member-info">
                      <span className="team-review-member-name">{c.name}</span>
                      <span className="team-review-member-role">{roleLabel(c.profile_data.role.role)}</span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setInvited((prev) => prev.filter((x) => x !== c.id))}
                    >
                      <X size={13} /> Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Wizard footer nav ── */}
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
            {step === 3 ? `Review (${invited.length})` : 'Continue'} <ArrowRight size={15} />
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={handleCreate} disabled={creating || invited.length === 0}>
            {creating ? <><Loader2 size={15} className="spin" /> Creating…</> : <><UserPlus size={15} /> Create Team</>}
          </button>
        )}
      </div>

      <button
        type="button"
        className="btn btn-ghost btn-sm"
        style={{ marginTop: 12 }}
        onClick={() => navigate(`/hackathons/${hackathon.id}`)}
      >
        <ArrowLeft size={13} /> Cancel
      </button>
    </div>
  );
};

export default TeamCreatePage;
