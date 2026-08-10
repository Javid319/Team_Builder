import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { User, Loader2, GitBranch, ExternalLink, ShieldCheck, FileText, Sparkles } from 'lucide-react';

const Dashboard = () => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [skills, setSkills] = useState<any[]>([]);
  const [personalityComplete, setPersonalityComplete] = useState(false);
  const [collaborationComplete, setCollaborationComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const evaluationMethod = localStorage.getItem('evaluation_method');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [meRes, profRes, skillsRes, personalityRes, collaborationRes] = await Promise.all([
          api.getMe().catch(() => ({ data: null })),
          api.getProfile().catch(() => ({ data: null })),
          api.getSkills().catch(() => ({ data: [] })),
          api.getPersonalityStatus().catch(() => ({ data: { completed: false } })),
          api.getCollabStatus().catch(() => ({ data: { completed: false } })),
        ]);
        setUser(meRes.data);
        setProfile(profRes.data);
        setSkills(skillsRes.data || []);
        setPersonalityComplete(Boolean(personalityRes.data?.completed));
        setCollaborationComplete(Boolean(collaborationRes.data?.completed));
      } catch (err) {
        console.error('Failed to fetch dashboard data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="main-workspace flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <Loader2 size={24} className="spin" color="var(--primary)" />
      </div>
    );
  }

  const githubVerifiedCount = skills.filter(s => s.source === 'github').length;
  const totalSkills = skills.length;

  return (
    <div className="main-workspace fade-in">
      
      {/* Workspace Top Header */}
      <div className="flex items-center justify-between mb-6 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="badge badge-primary">Developer Workspace</span>
            <span className="badge badge-success flex items-center gap-1">
              <ShieldCheck size={11} /> Profile Active
            </span>
          </div>
          <h1 style={{ fontSize: '22px', marginBottom: '2px' }}>
            {user?.full_name || profile?.name || 'Developer'}
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
            Verified technical competency matrix and hackathon team readiness status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/profile" className="btn btn-secondary btn-sm">
            <User size={13} /> Edit Profile
          </Link>
          <Link to="/assessment" className="btn btn-primary btn-sm">
            <BrainCircuitIcon size={13} /> Run AI Quiz
          </Link>
        </div>
      </div>

      {/* 4-Stat Metric Strip */}
      <div className="grid-4 gap-4 mb-6">
        <div className="card card-sm">
          <div className="text-subtle text-xs mb-1">Declared Skills</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)' }}>{totalSkills}</div>
          <div className="text-xs text-muted mt-1">Total stack entries</div>
        </div>

        <div className="card card-sm">
          <div className="text-subtle text-xs mb-1">GitHub Verified</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--success)' }}>{githubVerifiedCount}</div>
          <div className="text-xs text-success mt-1">Public repo evidence</div>
        </div>

        <div className="card card-sm">
          <div className="text-subtle text-xs mb-1">Verification Engine</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginTop: '4px' }}>
            {evaluationMethod === 'resume' ? 'GitHub & PDF' : 'AI Assessment'}
          </div>
          <div className="text-xs text-subtle mt-1">Active pipeline</div>
        </div>

        <div className="card card-sm">
          <div className="text-subtle text-xs mb-1">Experience Level</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary)', marginTop: '4px', textTransform: 'capitalize' }}>
            {profile?.experience_level || 'Beginner'}
          </div>
          <div className="text-xs text-subtle mt-1">Difficulty tier</div>
        </div>
      </div>

      <div className="grid-2 gap-4">
        <section className="card" style={{ alignSelf: 'start', borderColor: 'var(--primary)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={18} color="var(--primary)" />
            <h3 className="card-title">Boost your team recommendations</h3>
          </div>
          <p className="text-subtle text-xs" style={{ lineHeight: 1.6, maxWidth: '420px' }}>
            {personalityComplete && collaborationComplete
              ? 'Your assessment profile is complete. Retake the quiz any time to refresh your recommendations.'
              : 'Take the personality and collaboration assessments so we can recommend teammates who match how you work.'}
          </p>
          <Link
            to={!personalityComplete ? '/personality' : !collaborationComplete ? '/collaboration' : '/personality'}
            className="btn btn-primary mt-4"
          >
            <Sparkles size={14} /> Take the quiz
          </Link>
        </section>

        {/* Developer Passport */}
        <section>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title flex items-center gap-2">
                <User size={15} color="var(--primary)" /> Developer Passport
              </h3>
            </div>

            <div className="flex flex-col gap-3 text-xs mb-4">
              <div className="flex items-center justify-between" style={{ padding: '8px 10px', background: 'var(--surface-2)', borderRadius: '4px' }}>
                <span className="text-subtle">College</span>
                <span className="text-text font-medium">{profile?.college || 'Not set'}</span>
              </div>
              <div className="flex items-center justify-between" style={{ padding: '8px 10px', background: 'var(--surface-2)', borderRadius: '4px' }}>
                <span className="text-subtle">Degree</span>
                <span className="text-text font-medium">{profile?.degree || 'Not set'}</span>
              </div>
              <div className="flex items-center justify-between" style={{ padding: '8px 10px', background: 'var(--surface-2)', borderRadius: '4px' }}>
                <span className="text-subtle">Year of Study</span>
                <span className="text-text font-medium">Year {profile?.year_of_study || 1}</span>
              </div>
            </div>

            <div className="divider" style={{ margin: '14px 0' }} />

            <div className="flex flex-col gap-2">
              {profile?.github_url && (
                <a href={profile.github_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm justify-between">
                  <span className="flex items-center gap-2 text-xs">
                    <GitBranch size={13} /> GitHub Profile
                  </span>
                  <ExternalLink size={12} />
                </a>
              )}
              {profile?.linkedin_url && (
                <a href={profile.linkedin_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm justify-between">
                  <span className="flex items-center gap-2 text-xs">
                    <FileText size={13} /> LinkedIn Profile
                  </span>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>
        </section>
      </div>

    </div>
  );
};

const BrainCircuitIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/>
  </svg>
);

export default Dashboard;
