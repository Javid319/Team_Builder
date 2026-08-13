import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import {
  ArrowLeft,
  Clock,
  Loader2,
  RefreshCw,
  Search,
  UserPlus,
  Users,
  UsersRound,
} from 'lucide-react';
import type { JoinRequestOut, TeamGoal, TeamListItem } from '../types/team';
import { TEAM_GOAL_KEY } from '../types/team';

const statusLabel = (status: string) => status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

const TeamBrowsePage = () => {
  const [teams, setTeams] = useState<TeamListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [search, setSearch] = useState('');
  const [domain, setDomain] = useState('');
  const [myRequests, setMyRequests] = useState<JoinRequestOut[]>([]);
  const [inTeam, setInTeam] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyTeam, setBusyTeam] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const requestIdRef = useRef(0);

  const loadTeams = useCallback(async (query: { page: number; search: string; domain: string }) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError('');
    try {
      const params: Record<string, unknown> = { page: query.page, page_size: pageSize };
      if (query.search.trim()) params.search = query.search.trim();
      if (query.domain) params.domain = query.domain;
      const res = await api.getTeams(params);
      if (requestIdRef.current !== requestId) return;
      setTeams(res.data.items || []);
      setTotal(res.data.total || 0);
      setPage(res.data.page || 1);
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      console.error('Failed to load teams', err);
      setError('Failed to load teams. Please try again.');
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }, [pageSize]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [teamRes, reqsRes] = await Promise.all([
          api.getMyTeam().catch((err) => {
            if (err.response?.status === 404) return null;
            throw err;
          }),
          api.getMyJoinRequests().catch(() => ({ data: [] })),
        ]);
        if (cancelled) return;
        setInTeam(Boolean(teamRes));
        setMyRequests(reqsRes.data || []);
      } catch (err) {
        console.error('Failed to load team status', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => loadTeams({ page: 1, search, domain }), 250);
    return () => clearTimeout(timer);
  }, [search, domain, loadTeams]);

  const handleJoin = async (teamId: string) => {
    setBusyTeam(teamId);
    setNotice('');
    setError('');
    try {
      const res = await api.createJoinRequest(teamId);
      setMyRequests((prev) => [res.data, ...prev.filter((r) => r.team_id !== teamId)]);
      setNotice(`Join request sent to ${res.data.team?.name || 'the team'}.`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not request to join this team.');
    } finally {
      setBusyTeam(null);
    }
  };

  const requestFor = (teamId: string) => myRequests.find((r) => r.team_id === teamId);

  const domainOptions = Array.from(
    new Set(teams.flatMap((t) => t.domains || [])),
  ).sort();

  const goal = localStorage.getItem(TEAM_GOAL_KEY) as TeamGoal | null;

  return (
    <div className="main-workspace fade-in">
      <Link to="/teams/goal" className="hack-detail-back">
        <ArrowLeft size={15} /> Choose Your Goal
      </Link>

      <div className="team-hub-head">
        <div>
          <span className="badge badge-primary">Looking to Join a Team</span>
          <h1 className="team-create-title">Available Teams</h1>
          <p className="hack-detail-lede">Browse open teams and request to join.</p>
        </div>
        {goal === 'recruit' && (
          <Link to="/teams" className="btn btn-ghost btn-sm">Switch to finding members</Link>
        )}
      </div>

      {inTeam && (
        <div className="alert alert-info mb-3">
          You&apos;re already part of an active team — you can&apos;t request to join another.
          <Link to="/teams" style={{ marginLeft: 8 }}>View your team</Link>
        </div>
      )}

      {notice && <div className="alert alert-success mb-3">{notice}</div>}
      {error && <div className="alert alert-danger mb-3">{error}</div>}

      <div className="browse-toolbar">
        <label className="team-search" style={{ flex: 1, maxWidth: 360 }}>
          <Search size={14} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search team name or description…"
          />
        </label>

        <label className="form-group" style={{ marginBottom: 0 }}>
          <select
            className="form-control"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            style={{ minWidth: 180 }}
          >
            <option value="">All domains</option>
            {domainOptions.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => loadTeams({ page, search, domain })}
          disabled={loading}
        >
          <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center" style={{ minHeight: '30vh' }}>
          <Loader2 size={24} className="spin" color="var(--primary)" />
        </div>
      ) : teams.length === 0 ? (
        <div className="team-dash-empty" style={{ padding: 40 }}>
          <Search size={26} />
          <p>No open teams match your filters. Try widening your search.</p>
        </div>
      ) : (
        <>
          <div className="browse-grid">
            {teams.map((team) => {
              const request = requestFor(team.id);
              const canJoin = !inTeam && !request && team.open_slots > 0;
              return (
                <article key={team.id} className="browse-card">
                  <div className="browse-card-top">
                    <div className="browse-card-icon">
                      <UsersRound size={20} />
                    </div>
                    <div className="browse-card-identity">
                      <h3 className="browse-card-name">{team.name}</h3>
                      <span className="browse-card-owner">
                        {team.owner?.name ? `by ${team.owner.name}` : ''}
                      </span>
                    </div>
                    {team.open_slots > 0 ? (
                      <span className="badge badge-success">{team.open_slots} slot{team.open_slots === 1 ? '' : 's'}</span>
                    ) : (
                      <span className="badge badge-warning">Full</span>
                    )}
                  </div>

                  {team.description && <p className="browse-card-desc">{team.description}</p>}

                  <div className="flex wrap gap-1">
                    {team.domains.slice(0, 5).map((d) => <span key={d} className="skill-tag">{d}</span>)}
                  </div>

                  <div className="browse-card-meta">
                    <span><Users size={12} /> {team.current_size}/{team.max_members} members</span>
                    <span><Clock size={12} /> {statusLabel(team.status)}</span>
                  </div>

                  <div className="browse-card-actions">
                    {request ? (
                      <span className={`btn btn-sm btn-full ${request.status === 'PENDING' ? 'btn-ghost' : request.status === 'ACCEPTED' ? 'btn-secondary' : 'btn-outline'}`}>
                        {request.status === 'PENDING' && <><Clock size={13} /> Request Pending</>}
                        {request.status === 'ACCEPTED' && <><Users size={13} /> Accepted</>}
                        {request.status === 'REJECTED' && <><UserPlus size={13} /> Request Again</>}
                      </span>
                    ) : canJoin ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm btn-full"
                        disabled={busyTeam === team.id}
                        onClick={() => handleJoin(team.id)}
                      >
                        {busyTeam === team.id ? <><Loader2 size={13} className="spin" /> Requesting…</> : <><UserPlus size={13} /> Request to Join</>}
                      </button>
                    ) : (
                      <span className="btn btn-ghost btn-sm btn-full" style={{ cursor: 'not-allowed' }}>
                        {inTeam ? 'Already in a team' : 'Not available'}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {total > pageSize && (
            <div className="flex items-center justify-center gap-2" style={{ marginTop: 24 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={page <= 1 || loading}
                onClick={() => loadTeams({ page: page - 1, search, domain })}
              >
                Previous
              </button>
              <span className="text-subtle text-sm">Page {page}</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={page * pageSize >= total || loading}
                onClick={() => loadTeams({ page: page + 1, search, domain })}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TeamBrowsePage;
