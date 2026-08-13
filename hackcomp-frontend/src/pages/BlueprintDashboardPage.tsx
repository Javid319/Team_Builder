import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { ArrowLeft, Loader2, Users, Crown, User as UserIcon, Lock, Check, X, ChevronDown } from 'lucide-react';
import { roleLabel } from '../services/candidateService';
import { ToastBanner, useToast } from '../components/Toast';

interface DashboardMember {
  user_id: string;
  name: string;
  role: string;
  slot_role?: string;
}

interface DashboardSlot {
  id: string;
  role: string;
  status: string;
  skills: string[];
}

interface DashboardInvitation {
  id: string;
  status: string;
  slot_role?: string;
  blueprint_name?: string; // used for receiver name here
}

interface DashboardJoinRequest {
  id: string;
  user_id: string;
  user_name: string;
  status: string;
}

interface BlueprintDashboard {
  id: string;
  name: string;
  status: string;
  members: DashboardMember[];
  slots: DashboardSlot[];
  pending_invitations: DashboardInvitation[];
  pending_join_requests: DashboardJoinRequest[];
}

const BlueprintDashboardPage = () => {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboard, setDashboard] = useState<BlueprintDashboard | null>(null);
  // Tracks which join-request is awaiting slot selection: requestId → true
  const [slotSelectFor, setSlotSelectFor] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [toast, showToast] = useToast();

  const fetchDashboard = async () => {
    try {
      const res = await api.getBlueprintDashboard(id!);
      setDashboard(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [id]);

  const handleLock = async () => {
    if (!confirm('Are you sure you want to lock the team? No more members can join.')) return;
    try {
      await api.lockBlueprint(id!);
      fetchDashboard();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to lock team');
    }
  };

  const handleAcceptJoinRequest = async (requestId: string) => {
    if (!dashboard) return;
    const openSlots = dashboard.slots.filter(s => s.status === 'OPEN');
    if (openSlots.length === 0) {
      showToast('No open slots available to assign this candidate to.');
      return;
    }
    // Open the inline slot selector for this request
    setSlotSelectFor(requestId);
    setSelectedSlotId(openSlots[0].id);
  };

  const handleConfirmSlotAssignment = async () => {
    if (!slotSelectFor || !selectedSlotId) return;
    try {
      await api.acceptBlueprintJoinRequest(slotSelectFor, selectedSlotId);
      setSlotSelectFor(null);
      setSelectedSlotId('');
      fetchDashboard();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to accept join request');
    }
  };

  const handleRejectJoinRequest = async (requestId: string) => {
    try {
      await api.rejectBlueprintJoinRequest(requestId);
      fetchDashboard();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to reject join request');
    }
  };

  if (loading) {
    return (
      <div className="main-workspace flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <Loader2 size={24} className="spin" color="var(--primary)" />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="main-workspace fade-in">
        <div className="hack-detail-notfound">
          <Users size={32} />
          <h1>Cannot load dashboard</h1>
          <p className="text-subtle">{error}</p>
          <Link to="/dashboard" className="btn btn-primary btn-sm"><ArrowLeft size={14} /> Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="main-workspace fade-in">
      <ToastBanner toast={toast} />
      <Link to="/dashboard" className="hack-detail-back">
        <ArrowLeft size={15} /> Back to Dashboard
      </Link>

      <div className="team-create-head flex items-center justify-between">
        <div>
          <span className={`badge ${dashboard.status === 'OPEN' ? 'badge-primary' : dashboard.status === 'FULL' ? 'badge-danger' : dashboard.status === 'LOCKED' ? 'badge-danger' : 'badge-neutral'}`}>
            {dashboard.status}
          </span>
          <h1 className="team-create-title">{dashboard.name}</h1>
          <p className="text-subtle">Blueprint Dashboard</p>
        </div>
        <div className="flex gap-2">
          {dashboard.status !== 'LOCKED' && (
            <>
              <Link to={`/blueprints/${id}/recommendations`} className="btn btn-primary">Find Candidates</Link>
              <button className="btn btn-outline" onClick={handleLock}><Lock size={15} /> Lock Team</button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="team-panel">
          <h2 className="hack-detail-heading">Members</h2>
          <div className="team-review-members mt-4">
            {dashboard.members.map(m => (
              <div key={m.user_id} className="team-review-member">
                 {m.role === 'OWNER' ? <Crown size={18} color="var(--primary)" /> : <UserIcon size={18} />}
                 <div className="team-review-member-info">
                   <span className="team-review-member-name">{m.name}</span>
                   <span className="team-review-member-role">{m.role === 'OWNER' ? 'Owner' : roleLabel(m.slot_role || 'unknown')}</span>
                 </div>
              </div>
            ))}
          </div>
        </div>

        <div className="team-panel">
          <h2 className="hack-detail-heading">Blueprint Slots</h2>
          <div className="flex flex-col gap-4 mt-4">
            {dashboard.slots.map(s => (
              <div key={s.id} className="team-review-block flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{roleLabel(s.role)}</h3>
                  <div className="flex gap-2 mt-1">
                    {s.skills.map(sk => <span key={sk} className="skill-tag">{sk}</span>)}
                  </div>
                </div>
                <span className={`badge ${s.status === 'OPEN' ? 'badge-primary' : 'badge-neutral'}`}>
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        </div>
        
        {dashboard.pending_join_requests?.length > 0 && (
          <div className="team-panel">
            <h2 className="hack-detail-heading">Pending Join Requests</h2>
            <div className="flex flex-col gap-4 mt-4">
              {dashboard.pending_join_requests.map(req => (
                <div key={req.id} className="team-review-block flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{req.user_name}</h3>
                    <p className="text-subtle text-sm">Wants to join your team</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-sm btn-outline" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleRejectJoinRequest(req.id)}>
                      <X size={14} /> Reject
                    </button>
                    <button className="btn btn-sm btn-primary" onClick={() => handleAcceptJoinRequest(req.id)}>
                      <Check size={14} /> Accept
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {dashboard.pending_invitations.length > 0 && (
          <div className="team-panel">
            <h2 className="hack-detail-heading">Pending Invitations</h2>
            <div className="flex flex-col gap-4 mt-4">
              {dashboard.pending_invitations.map(inv => (
                <div key={inv.id} className="team-review-block flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{inv.blueprint_name}</h3>
                    <p className="text-subtle text-sm">Role: {roleLabel(inv.slot_role || 'unknown')}</p>
                  </div>
                  <span className="badge badge-neutral">Pending</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BlueprintDashboardPage;
