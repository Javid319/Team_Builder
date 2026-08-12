import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import SkillBadge from '../components/SkillBadge';
import { getSkillBadge, loadVerifiedSkills, passedSkillNames } from '../utils/skillBadges';
import HackathonGrid from '../components/hackathons/HackathonGrid';
import {
  User, Loader2, ArrowRight, Brain, FileText,
  Sparkles, Users, Wrench, CheckCircle2,
} from 'lucide-react';

// ── User Dashboard completion (0 base + three action steps) ──
const computeCompletion = (assessmentDone: boolean, verificationDone: boolean, recommendationDone: boolean): number => {
  let pct = 0;
  if (assessmentDone) pct += 30;          // Skill Assessment
  if (verificationDone) pct += 30;        // Resume & GitHub Verification
  if (recommendationDone) pct += 40;      // AI-powered Improve Team Recommendations
  return pct;
};

const completionNote = (pct: number) => {
  if (pct === 100) return 'Profile complete. Ready to match with teams.';
  if (pct >= 60) return 'Almost there — generate your AI team report to finish.';
  if (pct >= 30) return 'Good start. Complete the remaining steps to unlock better team matching.';
  return 'Complete the three steps below to build your profile.';
};

const CompletionRing = ({ percent }: { percent: number }) => {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);
  const color = percent === 100 ? 'var(--success)' : 'var(--primary)';

  return (
    <div className="completion-ring" role="img" aria-label={`Profile ${percent}% complete`}>
      <svg width="104" height="104" viewBox="0 0 104 104">
        <circle cx="52" cy="52" r={radius} fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle
          cx="52"
          cy="52"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 52 52)"
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s ease' }}
        />
      </svg>
      <div className="completion-ring-label">
        <span className="completion-ring-value">{percent}%</span>
        <span className="completion-ring-text">complete</span>
      </div>
    </div>
  );
};

// ── Compact progress card (single row item) ──
const ProgressCard = ({
  to,
  icon,
  iconClass,
  title,
  desc,
  done,
  children,
}: {
  to?: string;
  icon: React.ReactNode;
  iconClass?: string;
  title: string;
  desc: string;
  done?: boolean;
  children?: React.ReactNode;
}) => {
  const body = (
    <>
      <div className={`progress-card-icon ${iconClass || ''}`}>{icon}</div>
      <div className="progress-card-body">
        <span className="progress-card-title">
          {title}
          {done && <CheckCircle2 size={14} color="var(--success)" />}
        </span>
        <span className="progress-card-desc">{desc}</span>
        {children ?? (
          <span className="progress-card-cta">
            {done ? 'Completed' : 'Start'} <ArrowRight size={12} />
          </span>
        )}
      </div>
    </>
  );
  return to ? (
    <Link to={to} className="progress-card">{body}</Link>
  ) : (
    <div className="progress-card">{body}</div>
  );
};

const Dashboard = () => {
  const [skills, setSkills] = useState<any[]>([]);
  const [assessedNames, setAssessedNames] = useState<Set<string>>(new Set());
  const [verificationDone, setVerificationDone] = useState(false);
  const [quizDone, setQuizDone] = useState(false);
  const [recommendation, setRecommendation] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [widgetError, setWidgetError] = useState('');
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [skillsRes, skillAssessRes, personStatus, collabStatus, verificationRes, recRes, meRes] = await Promise.all([
          api.getSkills().catch(() => ({ data: [] })),
          api.getSkillResults().catch(() => ({ data: null })),
          api.getPersonalityStatus().catch(() => ({ data: { completed: false } })),
          api.getCollabStatus().catch(() => ({ data: { completed: false } })),
          api.getVerificationStatus().catch(() => ({ data: { completed: false } })),
          api.getRecommendations().catch(() => ({ data: null })),
          api.getMe().catch(() => ({ data: {} })),
        ]);
        setSkills(skillsRes.data || []);
        setAssessedNames(passedSkillNames(skillAssessRes.data?.skills || []));
        setQuizDone(Boolean(personStatus.data?.completed) && Boolean(collabStatus.data?.completed));
        setVerificationDone(Boolean(verificationRes.data?.completed));
        setRecommendation(recRes.data);
        setUserName(meRes.data?.full_name || '');
      } catch (err) {
        console.error('Failed to fetch dashboard data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleGenerateReport = async () => {
    setGenerating(true);
    setWidgetError('');
    try {
      const res = await api.generateRecommendations();
      setRecommendation(res.data);
    } catch (err: any) {
      setWidgetError(err.response?.data?.detail || 'AI report generation failed. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="main-workspace flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <Loader2 size={24} className="spin" color="var(--primary)" />
      </div>
    );
  }

  const totalSkills = skills.length;
  const assessmentDone = assessedNames.size > 0;
  const recommendationDone = Boolean(recommendation);
  const completion = computeCompletion(assessmentDone, verificationDone, recommendationDone);
  const verifiedNames = loadVerifiedSkills();
  const githubVerifiedCount = skills.filter((s) => {
    const badge = getSkillBadge(s.name, assessedNames, verifiedNames);
    return badge === 'verified' || badge === 'verified_assessed';
  }).length;

  return (
    <div className="main-workspace fade-in">

      {/* ── Header + Profile Completion ── */}
      <section className="dash-hero">
        <div className="dash-hero-main">
          <div className="dash-hero-eyebrow">User Dashboard</div>
          <h1 className="dash-hero-title">Hi, {userName || 'there'}</h1>
          <p className="dash-hero-sub">
            {completionNote(completion)}
          </p>
          <div className="flex wrap gap-2">
            <Link to="/profile/edit" className="btn btn-outline btn-sm">
              <User size={13} /> Edit Profile
            </Link>
            <Link to="/profile/edit" className="btn btn-ghost btn-sm">
              <Wrench size={13} /> Manage Skills
            </Link>
          </div>
        </div>

        <div className="dash-hero-stats">
          <CompletionRing percent={completion} />
          <div className="flex flex-col gap-2">
            <div className="dash-hero-stat">
              <span className="dash-hero-stat-value">{totalSkills}</span>
              <span className="dash-hero-stat-label">Skills</span>
            </div>
            <div className="dash-hero-stat">
              <span className="dash-hero-stat-value" style={{ color: 'var(--success)' }}>{githubVerifiedCount}</span>
              <span className="dash-hero-stat-label">Verified</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Compact progress cards (single row) ── */}
      <div className="dash-progress-grid">
        <ProgressCard
          to="/verification"
          icon={<FileText size={20} />}
          title="Resume & GitHub Verification"
          desc="Verify skills using resume evidence and repository analysis"
          done={verificationDone}
        />
        <ProgressCard
          to="/assessment"
          icon={<Brain size={20} />}
          title="Skill Assessment"
          desc="Validate selected skills through technical assessments"
          done={assessmentDone}
        />
        <ProgressCard
          icon={<Sparkles size={20} />}
          iconClass="is-warning"
          title="Improve Team Recommendations"
          desc={recommendationDone ? 'AI report generated' : 'Unlock better team matching'}
          done={recommendationDone}
        >
          {recommendationDone ? (
            <a href="#ai-report" className="progress-card-action">
              View Report <ArrowRight size={12} />
            </a>
          ) : quizDone ? (
            <button onClick={handleGenerateReport} disabled={generating} className="progress-card-action">
              {generating ? <><Loader2 size={12} className="spin" /> Generating...</> : <><Sparkles size={12} /> Generate AI Report</>}
            </button>
          ) : (
            <Link to="/test" className="progress-card-action">
              <Users size={12} /> Take this test
            </Link>
          )}
        </ProgressCard>
      </div>

      {/* ── Your Skills (compact) ── */}
      <section className="dash-summary mb-6">
        <div className="dash-summary-head">
          <h3 className="card-title flex items-center gap-2">
            <Wrench size={15} color="var(--primary)" /> Your Skills
          </h3>
          <Link to="/profile/edit" className="btn btn-ghost btn-sm">Manage Skills</Link>
        </div>
        {skills.length ? (
          <div className="flex wrap gap-2">
            {skills.map((s: any) => (
              <span key={s.id} className="skill-tag">
                {s.name}
                <SkillBadge badge={getSkillBadge(s.name, assessedNames, verifiedNames)} />
              </span>
            ))}
          </div>
        ) : (
          <p className="text-subtle">No skills added yet.</p>
        )}
      </section>

      {/* ── Upcoming Hackathons (mock data) ── */}
      <HackathonGrid limit={6} />

      {/* ── AI team report (shown when generated) ── */}
      {recommendationDone && (
        <aside id="ai-report" className="widget-recommend mb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="widget-recommend-icon">
              <Sparkles size={17} />
            </div>
            <h3 className="card-title">Your AI Team Report</h3>
            <span className="badge badge-primary flex items-center gap-1" style={{ marginLeft: 'auto' }}>
              <Sparkles size={11} /> AI powered
            </span>
          </div>

          <div className="ai-report">
            <p className="ai-report-summary">{recommendation.content.summary}</p>

            {recommendation.content.strengths?.length > 0 && (
              <div className="ai-report-section">
                <h4>Strengths</h4>
                <ul>{recommendation.content.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
              </div>
            )}
            {recommendation.content.improvements?.length > 0 && (
              <div className="ai-report-section">
                <h4>Improvements</h4>
                <ul>{recommendation.content.improvements.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
              </div>
            )}
            {recommendation.content.ideal_roles?.length > 0 && (
              <div className="ai-report-section">
                <h4>Ideal Roles</h4>
                <ul>{recommendation.content.ideal_roles.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
              </div>
            )}
            {recommendation.content.tips?.length > 0 && (
              <div className="ai-report-section">
                <h4>Tips</h4>
                <ul>{recommendation.content.tips.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
              </div>
            )}

            {widgetError && <div className="alert alert-danger mt-2">{widgetError}</div>}
            <button onClick={handleGenerateReport} disabled={generating} className="btn btn-ghost btn-sm mt-2">
              {generating ? <><Loader2 size={13} className="spin" /> Regenerating...</> : 'Regenerate report'}
            </button>
          </div>
        </aside>
      )}

    </div>
  );
};

export default Dashboard;
