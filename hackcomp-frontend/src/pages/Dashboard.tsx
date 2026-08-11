import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import SkillBadge from '../components/SkillBadge';
import { getSkillBadge, loadVerifiedSkills, passedSkillNames } from '../utils/skillBadges';
import {
  User, Loader2, GitBranch, ExternalLink, ArrowRight, GraduationCap, MapPin,
  Brain, ClipboardCheck, Award, Target, Sparkles, Users, Wrench,
} from 'lucide-react';

// ── Developer Hub completion (0 base + three action steps) ──
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

const Dashboard = () => {
  const [profile, setProfile] = useState<any>(null);
  const [skills, setSkills] = useState<any[]>([]);
  const [assessedNames, setAssessedNames] = useState<Set<string>>(new Set());
  const [verificationDone, setVerificationDone] = useState(false);
  const [quizDone, setQuizDone] = useState(false);
  const [recommendation, setRecommendation] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [widgetError, setWidgetError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profRes, skillsRes, skillAssessRes, personStatus, collabStatus, verificationRes, recRes] = await Promise.all([
          api.getProfile().catch(() => ({ data: null })),
          api.getSkills().catch(() => ({ data: [] })),
          api.getSkillResults().catch(() => ({ data: null })),
          api.getPersonalityStatus().catch(() => ({ data: { completed: false } })),
          api.getCollabStatus().catch(() => ({ data: { completed: false } })),
          api.getVerificationStatus().catch(() => ({ data: { completed: false } })),
          api.getRecommendations().catch(() => ({ data: null })),
        ]);
        setProfile(profRes.data);
        setSkills(skillsRes.data || []);
        setAssessedNames(passedSkillNames(skillAssessRes.data?.skills || []));
        setQuizDone(Boolean(personStatus.data?.completed) && Boolean(collabStatus.data?.completed));
        setVerificationDone(Boolean(verificationRes.data?.completed));
        setRecommendation(recRes.data);
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
  const experience = (profile?.experience_level || '').replace(/_/g, ' ');
  const location = [profile?.city, profile?.state].filter(Boolean).join(', ');
  const verifiedNames = loadVerifiedSkills();
  const githubVerifiedCount = skills.filter((s) => {
    const badge = getSkillBadge(s.name, assessedNames, verifiedNames);
    return badge === 'verified' || badge === 'verified_assessed';
  }).length;

  return (
    <div className="main-workspace fade-in">

      {/* ── Welcome Hero ── */}
      <section className="dash-hero">
        <div className="dash-hero-main">
          <div className="dash-hero-eyebrow">Developer Hub</div>
          <h1 className="dash-hero-title">Developer Hub</h1>
          <p className="dash-hero-sub">
            {completionNote(completion)}
          </p>
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

      {/* ── Action Cards ── */}
      <div className="grid-2 gap-4 mb-6 dash-actions">
        <Link to="/verification" className="action-card action-card-primary">
          <div className="action-card-top">
            <div className="action-card-icon">
              <GitBranch size={22} />
            </div>
            <span className="badge badge-neutral">Evidence-based</span>
          </div>
          <h3 className="action-card-title">Resume & GitHub Verification</h3>
          <p className="action-card-desc">
            Verify skills using resume evidence, repository analysis, imports, dependencies, topics and README content.
          </p>
          <span className="action-card-cta">
            Start Verification <ArrowRight size={15} />
          </span>
        </Link>

        <Link to="/assessment" className="action-card action-card-accent">
          <div className="action-card-top">
            <div className="action-card-icon" style={{ background: 'var(--warning-muted)', color: '#f59e0b' }}>
              <Brain size={22} />
            </div>
            <span className="badge badge-neutral">Adaptive quiz</span>
          </div>
          <h3 className="action-card-title">Skill Assessment</h3>
          <p className="action-card-desc">
            Validate selected skills through technical assessments.
          </p>
          <span className="action-card-cta">
            Take Assessment <ArrowRight size={15} />
          </span>
        </Link>
      </div>

      {/* ── Skills with badges ── */}
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

      {/* ── Bottom grid: profile summary + recommendations widget ── */}
      <div className="dash-bottom">

        <section className="dash-summary">
        <div className="dash-summary-head">
          <h3 className="card-title flex items-center gap-2">
            <User size={15} color="var(--primary)" /> Quick Profile Summary
          </h3>
          <Link to="/profile/edit" className="btn btn-ghost btn-sm">Edit Profile</Link>
        </div>

        <div className="dash-summary-grid">
          <div className="dash-summary-item">
            <span className="dash-summary-label"><GraduationCap size={12} /> College</span>
            <span className="dash-summary-value">{profile?.college || 'Not set'}</span>
          </div>
          <div className="dash-summary-item">
            <span className="dash-summary-label"><Award size={12} /> Degree</span>
            <span className="dash-summary-value">{profile?.degree || 'Not set'}</span>
          </div>
          <div className="dash-summary-item">
            <span className="dash-summary-label"><Target size={12} /> Department</span>
            <span className="dash-summary-value">{profile?.department || 'Not set'}</span>
          </div>
          <div className="dash-summary-item">
            <span className="dash-summary-label"><MapPin size={12} /> Location</span>
            <span className="dash-summary-value">{location || 'Not set'}</span>
          </div>
          <div className="dash-summary-item">
            <span className="dash-summary-label"><Sparkles size={12} /> Experience</span>
            <span className="dash-summary-value" style={{ textTransform: 'capitalize' }}>
              {experience || 'Not set'}
            </span>
          </div>
          <div className="dash-summary-item">
            <span className="dash-summary-label"><ClipboardCheck size={12} /> Skills</span>
            <span className="dash-summary-value">{totalSkills} declared</span>
          </div>
        </div>

        {(profile?.github_url || profile?.linkedin_url || profile?.leetcode_url) && (
          <>
            <div className="divider" style={{ margin: '16px 0' }} />
            <div className="flex wrap gap-2">
              {profile?.github_url && (
                <a href={profile.github_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                  <GitBranch size={13} /> GitHub <ExternalLink size={11} />
                </a>
              )}
              {profile?.linkedin_url && (
                <a href={profile.linkedin_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                  <User size={13} /> LinkedIn <ExternalLink size={11} />
                </a>
              )}
              {profile?.leetcode_url && (
                <a href={profile.leetcode_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                  <Target size={13} /> LeetCode <ExternalLink size={11} />
                </a>
              )}
            </div>
          </>
        )}
        </section>

        {/* ── Improve Team Recommendations widget ── */}
        <aside className="widget-recommend">
          <div className="flex items-center gap-2 mb-2">
            <div className="widget-recommend-icon">
              <Sparkles size={17} />
            </div>
            <h3 className="card-title">Improve Team Recommendations</h3>
          </div>

          {recommendationDone ? (
            <div className="ai-report">
              <span className="badge badge-primary flex items-center gap-1">
                <Sparkles size={11} /> AI powered
              </span>
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
          ) : quizDone ? (
            <>
              <p className="text-subtle mb-4">
                Your evaluations are complete. Generate your AI-powered team fit report to finish this step.
              </p>
              {widgetError && <div className="alert alert-danger mb-3">{widgetError}</div>}
              <button onClick={handleGenerateReport} disabled={generating} className="btn btn-primary btn-sm btn-full">
                {generating ? <><Loader2 size={14} className="spin" /> Analyzing with AI...</> : <><Sparkles size={14} /> Generate AI Report</>}
              </button>
            </>
          ) : (
            <>
              <p className="text-subtle mb-4">
                Take this test to promote the team recommendations.
              </p>
              <div className="flex flex-col gap-2">
                <Link to="/test" className="btn btn-primary btn-sm btn-full">
                  <Users size={14} /> Take this test
                </Link>
              </div>
            </>
          )}
        </aside>

      </div>

    </div>
  );
};

export default Dashboard;
