import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ResumeUpload from '../components/ResumeUpload';
import SkillBadge from '../components/SkillBadge';
import {
  Loader2, CheckCircle, ArrowRight, GitBranch, FileSearch, ShieldCheck,
  Package, BookOpen, Tag, Code, FileCode,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '../api';
import { getSkillBadge, loadVerifiedSkills, passedSkillNames, saveVerifiedSkills } from '../utils/skillBadges';

const RESUME_ENGINE_URL = 'http://localhost:8001';

type MatchedSkill = {
  resume_skill: string;
  github_skill: string;
  confidence: { score: number; level: string };
  evidence?: { source: string; repo?: string; detail?: string }[];
};

type VerificationResult = {
  matched_skills: MatchedSkill[];
  unmatched_skills: { resume_skill: string }[];
  statistics: {
    resume_skills_count: number;
    matched_count: number;
    unmatched_count: number;
    verification_percentage: number;
  };
};

const confidenceBadgeClass = (level: string) => {
  switch (level) {
    case 'VERY_HIGH': return 'badge-success';
    case 'HIGH':      return 'badge-success';
    case 'MEDIUM':    return 'badge-warning';
    default:          return 'badge-danger';
  }
};

// ── Evidence source taxonomy ─────────────────────────────────
const SOURCE_CONFIG: { key: string; label: string; icon: LucideIcon; match: string[] }[] = [
  { key: 'imports',      label: 'Imports',         icon: FileCode, match: ['import', 'imports'] },
  { key: 'dependencies', label: 'Dependencies',    icon: Package,  match: ['dependency', 'dependencies', 'dep'] },
  { key: 'readme',       label: 'README Mentions', icon: BookOpen, match: ['readme'] },
  { key: 'topics',       label: 'Topics',          icon: Tag,      match: ['topic', 'topics'] },
  { key: 'languages',    label: 'Languages',       icon: Code,     match: ['language', 'languages', 'lang'] },
];

const evidenceSourceCounts = (evidence: MatchedSkill['evidence'] = []) => {
  const counts: Record<string, number> = {};
  (evidence || []).forEach((e) => {
    const src = String(e.source || '').toLowerCase();
    const cfg = SOURCE_CONFIG.find((c) => c.match.includes(src));
    if (cfg) counts[cfg.key] = (counts[cfg.key] || 0) + 1;
  });
  return SOURCE_CONFIG.map((cfg) => ({
    key: cfg.key,
    label: cfg.label,
    icon: cfg.icon,
    count: counts[cfg.key] || 0,
  }));
};

const uniqueRepoCount = (evidence: MatchedSkill['evidence'] = []) =>
  new Set((evidence || []).map((e) => e.repo).filter(Boolean)).size;

const ResumeVerification = () => {
  const navigate = useNavigate();
  const [githubUsername, setGithubUsername] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [parsed, setParsed] = useState(false);
  const [assessedNames, setAssessedNames] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.getSkillResults()
      .then((res) => setAssessedNames(passedSkillNames(res.data?.skills || [])))
      .catch(() => {});
  }, []);

  const handleVerify = async () => {
    if (!file) {
      setError('Please select a PDF resume first.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (githubUsername.trim()) {
        formData.append('github_username', githubUsername.trim());
      }

      const res = await fetch(`${RESUME_ENGINE_URL}/parse`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Resume parsing failed');
      }

      const data = await res.json();

      const profile = data.resume_profile || data;
      if (profile.technical_skills?.length) {
        sessionStorage.setItem('verified_skills', JSON.stringify(profile.technical_skills));
      }

      if (data.github_verification?.status === 'completed') {
        setResult(data.github_verification);
        if (data.github_verification.matched_skills?.length) {
          saveVerifiedSkills(
            data.github_verification.matched_skills.map((m: any) => m.github_skill || m.resume_skill || m.skill),
          );
        }
      } else {
        setResult(null);
      }

      try {
        const uploadForm = new FormData();
        uploadForm.append('file', file);
        await api.uploadResume(uploadForm);
      } catch {
        // Non-critical
      }

      setParsed(true);
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    localStorage.setItem('evaluation_method', 'resume');
    navigate('/dashboard');
  };

  return (
    <div className="main-workspace fade-in">
      {/* Workspace Header */}
      <div className="flex items-center justify-between mb-6 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="badge badge-primary flex items-center gap-1">
              <ShieldCheck size={11} /> Resume & GitHub Verification
            </span>
          </div>
          <h1 style={{ fontSize: '22px', marginBottom: '4px' }}>GitHub & Resume Verification</h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
            Upload your resume PDF and enter your GitHub username for automated repository verification.
          </p>
        </div>
        <button onClick={() => navigate('/dashboard')} className="btn btn-ghost btn-sm">
          Back to Dashboard
        </button>
      </div>

      {error && <div className="alert alert-danger mb-4">{error}</div>}

      {parsed ? (
        /* ── Results View ── */
        <div className="flex flex-col gap-6">
          {result ? (
            <>
              {/* Stat overview */}
              <div className="grid-3 gap-4 mb-2">
                <div className="card card-sm text-center">
                  <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--primary)' }}>
                    {result.statistics.verification_percentage}%
                  </div>
                  <div className="text-subtle text-xs mt-1">Verification Confidence</div>
                </div>

                <div className="card card-sm text-center">
                  <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--success)' }}>
                    {result.statistics.matched_count}
                  </div>
                  <div className="text-subtle text-xs mt-1">Skills Verified</div>
                </div>

                <div className="card card-sm text-center">
                  <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--muted)' }}>
                    {result.statistics.unmatched_count}
                  </div>
                  <div className="text-subtle text-xs mt-1">Resume Declared</div>
                </div>
              </div>

              {/* Verified skills — modern evidence cards */}
              {result.matched_skills.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="card-title flex items-center gap-2">
                      <CheckCircle size={15} color="var(--success)" /> Verified on GitHub
                    </h3>
                    <span className="badge badge-success">{result.matched_skills.length} matched</span>
                  </div>

                  <div className="grid-2 gap-4">
                    {result.matched_skills
                      .slice()
                      .sort((a, b) => b.confidence.score - a.confidence.score)
                      .map((s) => {
                        const sources = evidenceSourceCounts(s.evidence);
                        const repos = uniqueRepoCount(s.evidence);
                        return (
                          <div key={s.resume_skill} className="skill-evidence-card">
                            <div className="card-header">
                              <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
                                <h4 style={{ fontSize: '15px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {s.resume_skill}
                                </h4>
                                <SkillBadge badge={getSkillBadge(s.resume_skill, assessedNames, loadVerifiedSkills())} />
                              </div>
                              <span className={`badge ${confidenceBadgeClass(s.confidence.level)}`}>
                                {s.confidence.level.replace(/_/g, ' ')}
                              </span>
                            </div>

                            <div className="skill-evidence-stats">
                              <div className="skill-evidence-stat">
                                <span className="skill-evidence-stat-value">{s.confidence.score}</span>
                                <span className="skill-evidence-stat-label">Confidence Score</span>
                              </div>
                              <div className="skill-evidence-stat">
                                <span className="skill-evidence-stat-value">{s.evidence?.length || 0}</span>
                                <span className="skill-evidence-stat-label">Evidence</span>
                              </div>
                              <div className="skill-evidence-stat">
                                <span className="skill-evidence-stat-value">{repos}</span>
                                <span className="skill-evidence-stat-label">Repositories</span>
                              </div>
                            </div>

                            <div className="evidence-sources">
                              {sources.map((src) => (
                                <span key={src.key} className={`evidence-chip ${src.count ? 'has-evidence' : ''}`}>
                                  <src.icon size={12} /> {src.label}
                                  <span className="evidence-chip-count">{src.count}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {result.unmatched_skills.length > 0 && (
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title flex items-center gap-2">
                      <FileSearch size={15} color="var(--subtle)" /> Declared on Resume
                    </h3>
                    <span className="badge badge-neutral">{result.unmatched_skills.length} skills</span>
                  </div>
                  <div className="flex wrap gap-2">
                    {result.unmatched_skills.map((s) => (
                      <span key={s.resume_skill} className="skill-tag">
                        {s.resume_skill}
                        <SkillBadge badge={getSkillBadge(s.resume_skill, assessedNames, loadVerifiedSkills())} />
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="card text-center" style={{ padding: '32px' }}>
              <CheckCircle size={28} color="var(--success)" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: '16px', marginBottom: '6px' }}>Resume parsed successfully</h3>
              <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
                Your technical skills have been extracted and attached to your developer profile.
              </p>
            </div>
          )}

          <button onClick={handleDone} className="btn btn-primary btn-full btn-lg">
            Done — View Dashboard <ArrowRight size={15} />
          </button>
        </div>
      ) : (
        /* ── Form View (Upload & Repo Setup) ── */
        <div className="grid-sidebar gap-6 items-start mb-6">
          <div className="flex flex-col gap-4">
            <ResumeUpload file={file} setFile={setFile} />

            <div className="card">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label flex items-center gap-2">
                  <GitBranch size={14} color="var(--primary)" /> GitHub Username <span className="optional">(optional — triggers code inspection)</span>
                </label>
                <input
                  id="github-username-input"
                  type="text"
                  className="form-control"
                  placeholder="e.g. DanielSebastin"
                  value={githubUsername}
                  onChange={(e) => setGithubUsername(e.target.value)}
                />
              </div>
            </div>

            <button
              id="verify-submit-btn"
              onClick={handleVerify}
              disabled={loading || !file}
              className="btn btn-primary btn-full btn-lg"
            >
              {loading ? (
                <><Loader2 size={15} className="spin" /> {githubUsername ? 'Scanning Repos & Verifying...' : 'Parsing Resume PDF...'}</>
              ) : (
                githubUsername ? 'Parse & Verify Repos' : 'Parse Resume PDF'
              )}
            </button>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">How Verification Works</h3>
            </div>
            <div className="flex flex-col gap-3 text-xs text-subtle" style={{ lineHeight: 1.6 }}>
              <div><strong>1. PDF Extraction:</strong> Fast text parsing extracts listed languages and frameworks.</div>
              <div><strong>2. GitHub Deep Scanner:</strong> If username is provided, public repositories are scanned for commit topics, imports, and lockfiles.</div>
              <div><strong>3. Confidence Score:</strong> Overlapping skills receive high-confidence badges for hackathon team matching.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResumeVerification;
