import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { ArrowLeft, Loader2, Mail, Check, X } from 'lucide-react';
import { roleLabel } from '../services/candidateService';
import { ToastBanner, useToast } from '../components/Toast';

interface BlueprintInvitation {
  id: string;
  blueprint_id: string;
  slot_id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  created_at: string;
  blueprint_name?: string;
  slot_role?: string;
  sender_name?: string;
}

const BlueprintInvitationsPage = () => {
  const [loading, setLoading] = useState(true);
  const [invitations, setInvitations] = useState<BlueprintInvitation[]>([]);
  const [toast, showToast] = useToast();

  const fetchInvitations = async () => {
    try {
      const res = await api.getMyBlueprintInvitations();
      setInvitations(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, []);

  const handleAccept = async (id: string) => {
    try {
      await api.acceptBlueprintInvitation(id);
      showToast('Invitation accepted!', 'success');
      fetchInvitations();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to accept invitation');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await api.rejectBlueprintInvitation(id);
      showToast('Invitation rejected.', 'success');
      fetchInvitations();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to reject invitation');
    }
  };

  if (loading) {
    return (
      <div className="main-workspace flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <Loader2 size={24} className="spin" color="var(--primary)" />
      </div>
    );
  }

  const pending = invitations.filter(i => i.status === 'PENDING');
  const past = invitations.filter(i => i.status !== 'PENDING');

  return (
    <div className="main-workspace fade-in">
      <ToastBanner toast={toast} />
      <Link to="/dashboard" className="hack-detail-back">
        <ArrowLeft size={15} /> Back to Dashboard
      </Link>

      <div className="team-create-head">
        <div>
          <span className="badge badge-primary">Incoming</span>
          <h1 className="team-create-title">My Invitations</h1>
          <p className="text-subtle">Blueprint invitations you've received.</p>
        </div>
      </div>

      <div className="team-panel">
        <h2 className="hack-detail-heading">Pending Invitations</h2>
        {pending.length === 0 ? (
          <div className="hack-grid-empty">
            <Mail size={26} />
            <p>You have no pending invitations.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {pending.map(inv => (
              <div key={inv.id} className="team-review-block flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{inv.blueprint_name}</h3>
                  <p className="text-subtle">
                    Role offered: <strong>{roleLabel(inv.slot_role || 'unknown')}</strong>
                  </p>
                  <p className="text-sm text-subtle">Invited by: {inv.sender_name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" className="btn btn-sm btn-outline" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleReject(inv.id)}>
                    <X size={14} /> Reject
                  </button>
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => handleAccept(inv.id)}>
                    <Check size={14} /> Accept
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {past.length > 0 && (
        <div className="team-panel mt-6">
          <h2 className="hack-detail-heading">Past Invitations</h2>
          <div className="flex flex-col gap-4">
            {past.map(inv => (
              <div key={inv.id} className="team-review-block flex items-center justify-between opacity-70">
                <div>
                  <h3 className="text-lg font-semibold">{inv.blueprint_name}</h3>
                  <p className="text-subtle">Role: {roleLabel(inv.slot_role || 'unknown')}</p>
                </div>
                <span className={`badge ${inv.status === 'ACCEPTED' ? 'badge-primary' : 'badge-neutral'}`}>
                  {inv.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BlueprintInvitationsPage;
