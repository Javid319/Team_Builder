import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { ArrowLeft, Loader2, Users, Search, Building2, CheckCircle2 } from 'lucide-react';
import { roleLabel } from '../services/candidateService';
import { ToastBanner, useToast } from '../components/Toast';

interface BlueprintList {
  id: string;
  name: string;
  description: string;
  hackathon_id: string;
  domains: string[];
  status: string;
  member_count: number;
  open_slots: number;
  roles_needed: string[];
}

const BlueprintBrowsePage = () => {
  const [searchParams] = useSearchParams();
  const hackathonId = searchParams.get('hackathonId');
  const domainsStr = searchParams.get('domains');
  const preferredDomains = domainsStr ? domainsStr.split(',').filter(Boolean) : [];

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [blueprints, setBlueprints] = useState<BlueprintList[]>([]);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  // Track blueprints where a join request has already been sent this session
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, showToast] = useToast();

  useEffect(() => {
    if (!hackathonId) {
      setLoading(false);
      return;
    }
    api.getBlueprints(hackathonId)
      .then(res => setBlueprints(res.data))
      .catch(err => {
        console.error(err);
        setError(err.response?.data?.detail || 'Failed to load blueprints.');
      })
      .finally(() => setLoading(false));
  }, [hackathonId]);

  const handleJoin = async (blueprintId: string) => {
    setRequestingId(blueprintId);
    try {
      await api.requestToJoinBlueprint(blueprintId);
      setSentRequests(prev => new Set(prev).add(blueprintId));
      showToast('Join request sent!', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to send join request');
    } finally {
      setRequestingId(null);
    }
  };

  if (!hackathonId) {
    return <div className="main-workspace p-8 text-danger">Missing hackathonId parameter.</div>;
  }

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
          <Search size={26} />
          <p>{error}</p>
          <Link to="/dashboard" className="btn btn-primary btn-sm">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  // Basic sorting: blueprints that match preferred domains go first
  const filteredBlueprints = blueprints.filter(bp => 
    bp.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedBlueprints = [...filteredBlueprints].sort((a, b) => {
    const aMatch = a.domains.some(d => preferredDomains.includes(d)) ? 1 : 0;
    const bMatch = b.domains.some(d => preferredDomains.includes(d)) ? 1 : 0;
    return bMatch - aMatch;
  });

  return (
    <div className="main-workspace fade-in">
      <ToastBanner toast={toast} />
      <Link to={`/hackathons/${hackathonId}`} className="hack-detail-back">
        <ArrowLeft size={15} /> Back to Hackathon
      </Link>

      <div className="team-create-head flex items-center justify-between">
        <div>
          <span className="badge badge-primary">Discovery</span>
          <h1 className="team-create-title">Browse Blueprints</h1>
          <p className="text-subtle">Find a team to join that matches your skills.</p>
        </div>
        <div className="flex items-center gap-2" style={{ minWidth: 250 }}>
          <div className="form-group mb-0 w-full" style={{ position: 'relative' }}>
            <Search size={16} className="text-subtle" style={{ position: 'absolute', left: 12, top: 12 }} />
            <input 
              type="text" 
              className="form-control" 
              placeholder="Search teams..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '2.25rem' }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 mt-6">
        {sortedBlueprints.length === 0 ? (
          <div className="hack-grid-empty">
            <Search size={26} />
            <p>No open blueprints found for this hackathon.</p>
          </div>
        ) : (
          sortedBlueprints.map(bp => {
            const isMatch = bp.domains.some(d => preferredDomains.includes(d));
            return (
              <div key={bp.id} className="team-panel flex items-start justify-between" style={{ padding: '1.5rem' }}>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold">{bp.name}</h3>
                    {isMatch && <span className="badge badge-warning">Matches Interests</span>}
                    <span className="badge badge-neutral">{bp.status}</span>
                  </div>
                  <p className="text-subtle">{bp.description || 'No description provided.'}</p>
                  
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1 text-sm text-subtle">
                      <Users size={14} /> {bp.member_count} Members
                    </div>
                    <div className="flex items-center gap-1 text-sm text-subtle">
                      <Search size={14} /> {bp.open_slots} Open Slots
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-2">
                    {bp.domains.map(d => (
                      <span key={d} className="badge badge-neutral bg-surface" style={{ background: 'var(--background)' }}><Building2 size={12} className="inline mr-1" /> {d}</span>
                    ))}
                  </div>

                  <div className="mt-2">
                    <span className="text-sm font-semibold">Roles needed: </span>
                    <span className="text-sm text-subtle">
                      {bp.roles_needed.map(r => roleLabel(r)).join(', ')}
                    </span>
                  </div>
                </div>
                
                <div className="flex flex-col gap-2 min-w-[140px]">
                  {sentRequests.has(bp.id) ? (
                    <span className="btn btn-ghost btn-sm" style={{ cursor: 'default', color: 'var(--success)' }}>
                      <CheckCircle2 size={14} /> Request Sent
                    </span>
                  ) : (
                    <button 
                      type="button" 
                      className="btn btn-primary"
                      onClick={() => handleJoin(bp.id)}
                      disabled={requestingId === bp.id}
                    >
                      {requestingId === bp.id ? <Loader2 size={15} className="spin" /> : 'Request to Join'}
                    </button>
                  )}
                  <Link to={`/blueprints/${bp.id}/dashboard`} className="btn btn-outline">View Team</Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default BlueprintBrowsePage;
