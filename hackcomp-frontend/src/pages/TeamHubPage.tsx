import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import Avatar from '../components/Avatar';
import {
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  Loader2,
  Mail,
  Shield,
  Sparkles,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type {
  InvitationOut,
  JoinRequestOut,
  MemberRecommendation,
  TeamGoal,
  TeamOut,
} from '../types/team';
import { TEAM_DOMAINS, TEAM_GOAL_KEY } from '../types/team';

const statusLabel = (status: string) => status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
const roleLabel = (role: string) => role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// ═══════════════════════════════════════════════════════════════
// Team creation form (shown when the user has no active team)
// ═══════════════════════════════════════════════════════════════
const TeamCreateForm = ({ onCreated }: { onCreated: () => void }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [domains, setDomains] = useState<string[]>([]);
  const [maxMembers, setMaxMembers] = useState<number>(4);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const toggleDomain = (domain: string) =>
    setDomains((prev) => (prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain]));

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Give your team a name.');
      return;
    }
    setCreating(true);
    setError('');
    try {
      await api.createTeam({
        name: name.trim(),
        description: description.trim() || null,
        domains,
        max_members: maxMembers,
      });
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Team creation failed. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className="team-panel team-create-form">
      <div className="dash-summary-head" style={{ marginBottom: 18 }}>
        <div>
          <h3 className="card-title flex items-center gap-2">
            <Building2 size={15} color="var(--primary)" /> Create Your Team
          </h3>
          <p className="text-subtle" style={{ marginTop: 4 }}>
            You&apos;re not part of a team yet. Start one and find teammates.
          </p>
        </div>
      </div>

      <div className="team-form" style={{ maxWidth: 640 }}>
        <label className="form-group">
          <span className="form-label">Team name</span>
          <input
            className="form-control"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Byte Brigade"
            maxLength={255}
          />
        </label>

        <div className="form-group">
          <span className="form-label">Domains</span>
          <div className="flex wrap gap-2">
            {TEAM_DOMAINS.map((domain) => {
              const active = domains.includes(domain);
              return (
                <button
                  key={domain}
                  type="button"
                  className={`filter-chip ${active ? 'is-active' : ''}`}
                  onClick={() => toggleDomain(domain)}
                >
                  {active && <Check size={11} />} {domain}
                </button>
              );
            })}
          </div>
        </div>

        <label className="form-group">
          <span className="form-label">Team size (max members)</span>
          <input
            className="form-control"
            type="number"
            min={2}
            max={10}
            value={maxMembers}
            onChange={(e) => setMaxMembers(Math.max(2, Math.min(10, Number(e.target.value) || 2)))}
          />
        </label>

        <label className="form-group">
          <span className="form-label">Description (optional)</span>
          <textarea
            className="form-control"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is your team building? Roles you're looking for?"
            maxLength={500}
          />
        </label>

        {error && <div className="alert alert-danger mt-2">{error}</div>}

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleCreate}
          disabled={creating}
        >
          {creating ? <><Loader2 size={15} className="spin" /> Creating…</> : <><UserPlus size={15} /> Create Team</>}
        </button>
      </div>
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════
// Team dashboard (shown when the user is in an active team)
// ═══════════════════════════════════════════════════════════════
const Dashboard = ({ team, meId, onTeamUpdated }: { team: TeamOut; meId: string; onTeamUpdated: () => void }) => {
  const isOwner = team.owner_id === meId;

  const [recommendations, setRecommendations] = useState<MemberRecommendation[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequestOut[]>([]);
  const [invitations, setInvitations] = useState<InvitationOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const refresh = useCallback(async () => {
    try {
      const [recs, invites, reqs] = await Promise.all([
        api.getMemberRecommendations().catch(() => ({ data: [] })),
        api.getMyInvitations().catch(() => ({ data: [] })),
        isOwner ? api.getTeamJoinRequests(team.id).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      ]);
      setRecommendations(recs.data);
      setInvitations((invites.data || []).filter((i: InvitationOut) => i.status === 'PENDING'));
      setJoinRequests((reqs.data || []).filter((r: JoinRequestOut) => r.status === 'PENDING'));
      setError('');
    } catch (err) {
      console.error('Failed to load team dashboard', err);
      setError('Failed to load team data. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [team.id, isOwner]);

  useEffect(() => { refresh(); }, [refresh]);

  const runAction = async (
    key: string,
    action: () => Promise<unknown>,
    refreshTeam = false,
  ) => {
    setBusy((prev) => ({ ...prev, [key]: true }));
    try {
      await action();
      await refresh();
      if (refreshTeam) onTeamUpdated();
    } catch (err: any) {
      console.error('Action failed', err);
      setError(err.response?.data?.detail || 'Action failed. Please try again.');
    } finally {
      setBusy((prev) => ({ ...prev, [key]: false }));
    }
  };

  const pendingInvitations = invitations.filter((i) => i.status === 'PENDING');

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '40vh' }}>
        <Loader2 size={24} className="spin" color="var(--primary)" />
      </div>
    );
  }

  return (
    <div className="team-dash">
      {error && <div className="alert alert-danger mb-3">{error}</div>}

      {/* ── Team overview ── */}
      <section className="team-dash-hero">
        <div className="team-dash-hero-main">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="badge badge-primary">{team.status}</span>
            <span className="badge badge-neutral">
              {team.member_count}/{team.max_members} members
            </span>
          </div>
          <h1 className="team-dash-title">{team.name}</h1>
          {team.description && <p className="text-subtle">{team.description}</p>}
          <div className="flex wrap gap-2" style={{ marginTop: 12 }}>
            {team.domains.map((d) => <span key={d} className="skill-tag">{d}</span>)}
          </div>
        </div>
        <div className="team-dash-hero-stats">
          <div className="team-dash-hero-stat">
            <span className="team-dash-hero-stat-value">{team.member_count}</span>
            <span className="team-dash-hero-stat-label">Members</span>
          </div>
          <div className="team-dash-hero-stat">
            <span className="team-dash-hero-stat-value" style={{ color: 'var(--success)' }}>
              {team.max_members - team.member_count}
            </span>
            <span className="team-dash-hero-stat-label">Open slots</span>
          </div>
          <div className="team-dash-hero-stat">
            <span className="team-dash-hero-stat-value">{recommendations.length}</span>
            <span className="team-dash-hero-stat-label">Matches</span>
          </div>
        </div>
      </section>

      <div className="team-dash-grid">
        {/* ── Recommended members ── */}
        <section className="team-dash-panel team-dash-panel-wide">
          <div className="dash-summary-head">
            <h3 className="card-title flex items-center gap-2">
              <Sparkles size={15} color="var(--primary)" /> Recommended Members
            </h3>
          </div>

          {recommendations.length === 0 ? (
            <div className="team-dash-empty">
              <Users size={26} />
              <p>No recommended members right now. Complete your profile to unlock better matches.</p>
            </div>
          ) : (
            <div className="team-reco-grid">
              {recommendations.map((candidate) => {
                const busyKey = `invite:${candidate.user_id}`;
                return (
                  <article key={candidate.user_id} className="team-reco-card">
                    <div className="team-reco-top">
                      <Avatar name={candidate.name} avatarUrl={candidate.avatar_url} size={42} />
                      <div className="team-reco-identity">
                        <h4 className="team-reco-name">{candidate.name}</h4>
                        <span className="team-reco-role">{roleLabel(candidate.role)}</span>
                      </div>
                      <span className="team-reco-score" title="Compatibility score">
                        {candidate.compatibility_score}%
                      </span>
                    </div>

                    <p className="team-reco-bio">{candidate.bio}</p>

                    <div className="flex wrap gap-1" style={{ marginTop: 2 }}>
                      {candidate.skills.slice(0, 4).map((s) => <span key={s} className="skill-tag">{s}</span>)}
                    </div>

                    <div className="team-reco-meta">
                      {candidate.college && <span><Building2 size={11} /> {candidate.college}</span>}
                      {candidate.domain_match.length > 0 && (
                        <span className="text-success"><CheckCircle2 size={11} /> {candidate.domain_match.length} domain match</span>
                      )}
                    </div>

                    {isOwner && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm btn-full"
                        disabled={Boolean(busy[busyKey])}
                        onClick={() => runAction(busyKey, () => api.inviteMember(team.id, { receiver_id: candidate.user_id }))}
                      >
                        {busy[busyKey] ? <><Loader2 size={13} className="spin" /> Inviting…</> : <><UserPlus size={13} /> Invite</>}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Team members ── */}
        <section className="team-dash-panel">
          <div className="dash-summary-head">
            <h3 className="card-title flex items-center gap-2">
              <Users size={15} color="var(--primary)" /> Team Members
            </h3>
            <span className="badge badge-neutral">{team.member_count}</span>
          </div>

          <div className="team-members-list">
            {team.members.map((member) => (
              <div key={member.id} className="team-member-row">
                <Avatar name={member.name} size={34} />
                <div className="team-member-info">
                  <span className="team-member-name">{member.name || 'Member'}</span>
                  <span className="text-subtle text-xs">{member.email}</span>
                </div>
                {member.role === 'OWNER' ? (
                  <span className="badge badge-primary"><Shield size={11} /> Owner</span>
                ) : (
                  <span className="badge badge-neutral">{statusLabel(member.role)}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── Pending invitations ── */}
      <div className="team-dash-grid">
        <section className="team-dash-panel team-dash-panel-wide">
          <div className="dash-summary-head">
            <h3 className="card-title flex items-center gap-2">
              <Mail size={15} color="var(--warning)" /> Pending Invitations
            </h3>
          </div>

          {isOwner && joinRequests.length === 0 && pendingInvitations.length === 0 && (
            <div className="team-dash-empty">
              <CheckCircle2 size={24} />
              <p>No pending invitations right now.</p>
            </div>
          )}

          {isOwner && joinRequests.length > 0 && (
            <>
              <h4 className="team-dash-subheading">Join requests for your team</h4>
              <div className="team-requests-list">
                {joinRequests.map((request) => {
                  const acceptKey = `accept:${request.id}`;
                  const rejectKey = `reject:${request.id}`;
                  return (
                    <div key={request.id} className="team-request-row">
                      <Avatar name={request.user?.name || 'Candidate'} size={36} />
                      <div className="team-request-info">
                        <span className="team-request-name">{request.user?.name || 'Candidate'}</span>
                        <span className="text-subtle text-xs">
                          {request.user?.college || 'Developer'}
                          {request.user?.role ? ` · ${roleLabel(request.user.role)}` : ''}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={Boolean(busy[acceptKey])}
                          onClick={() => runAction(acceptKey, () => api.acceptJoinRequest(request.id))}
                        >
                          {busy[acceptKey] ? <Loader2 size={13} className="spin" /> : <><Check size={13} /> Accept</>}
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={Boolean(busy[rejectKey])}
                          onClick={() => runAction(rejectKey, () => api.rejectJoinRequest(request.id))}
                        >
                          {busy[rejectKey] ? <Loader2 size={13} className="spin" /> : <X size={13} />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {pendingInvitations.length > 0 && (
            <>
              {isOwner && joinRequests.length > 0 && <div className="divider" style={{ margin: '16px 0' }} />}
              <h4 className="team-dash-subheading">Invitations you received</h4>
              <div className="team-requests-list">
                {pendingInvitations.map((invite) => {
                  const acceptKey = `inv-accept:${invite.id}`;
                  const rejectKey = `inv-reject:${invite.id}`;
                  return (
                    <div key={invite.id} className="team-request-row">
                      <Avatar name={invite.sender?.name} size={36} />
                      <div className="team-request-info">
                        <span className="team-request-name">{invite.team?.name}</span>
                        <span className="text-subtle text-xs">
                          Invited by {invite.sender?.name || 'Unknown'} · {invite.team?.member_count}/{invite.team?.max_members} members
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={Boolean(busy[acceptKey])}
                          onClick={() => runAction(acceptKey, () => api.acceptInvitation(invite.id))}
                        >
                          {busy[acceptKey] ? <Loader2 size={13} className="spin" /> : <><Check size={13} /> Accept</>}
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={Boolean(busy[rejectKey])}
                          onClick={() => runAction(rejectKey, () => api.rejectInvitation(invite.id))}
                        >
                          {busy[rejectKey] ? <Loader2 size={13} className="spin" /> : <X size={13} />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// Page — decides between creation form and dashboard
// ═══════════════════════════════════════════════════════════════
const TeamHubPage = () => {
  const [team, setTeam] = useState<TeamOut | null>(null);
  const [meId, setMeId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [meRes, teamRes] = await Promise.all([
        api.getMe().catch(() => ({ data: {} })),
        api.getMyTeam().catch((err) => {
          if (err.response?.status === 404) return null;
          throw err;
        }),
      ]);
      setMeId(meRes.data?.id || '');
      setTeam(teamRes ? teamRes.data : null);
    } catch (err) {
      console.error('Failed to load team hub', err);
      setLoadError('Failed to load your team data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const goal = localStorage.getItem(TEAM_GOAL_KEY) as TeamGoal | null;

  if (loading) {
    return (
      <div className="main-workspace flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <Loader2 size={24} className="spin" color="var(--primary)" />
      </div>
    );
  }

  return (
    <div className="main-workspace fade-in">
      <Link to="/teams/goal" className="hack-detail-back">
        <ArrowLeft size={15} /> Choose Your Goal
      </Link>

      {loadError ? (
        <div className="alert alert-danger">{loadError}</div>
      ) : team ? (
        <>
          <div className="team-hub-head">
            <div>
              <span className="badge badge-primary">Looking for Members</span>
              <h1 className="team-create-title">Your Team</h1>
            </div>
            {goal === 'join' && (
              <Link to="/teams/browse" className="btn btn-ghost btn-sm">Switch to joining a team</Link>
            )}
          </div>
          <Dashboard team={team} meId={meId} onTeamUpdated={load} />
        </>
      ) : (
        <>
          <div className="team-hub-head">
            <div>
              <span className="badge badge-primary">Looking for Members</span>
              <h1 className="team-create-title">Build Your Team</h1>
            </div>
            {goal === 'join' && (
              <Link to="/teams/browse" className="btn btn-ghost btn-sm">Switch to joining a team</Link>
            )}
          </div>
          <TeamCreateForm onCreated={load} />
        </>
      )}
    </div>
  );
};

export default TeamHubPage;
