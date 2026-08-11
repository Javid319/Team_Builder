import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import SkillBadge from '../components/SkillBadge';
import { getSkillBadge, loadVerifiedSkills, passedSkillNames } from '../utils/skillBadges';
import { ArrowLeft, ArrowRight, BrainCircuit, CheckCircle2, Clock, Loader2, Timer } from 'lucide-react';

const SkillAssessment = () => {
  const [session, setSession] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [error, setError] = useState('');

  const [qIndex, setQIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const sessionRef = useRef<any>(null);
  const qIndexRef = useRef(0);
  const timeoutHandledRef = useRef(false);
  const submitRef = useRef<() => void>(() => {});

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return (
      d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) +
      ' · ' +
      d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    );
  };

  const statusBadge = (status: string) => {
    const s = String(status).toLowerCase();
    if (s === 'completed') return 'badge-success';
    if (s === 'submitted') return 'badge-warning';
    if (s === 'failed') return 'badge-danger';
    return 'badge-neutral';
  };

  const titleCase = (val?: string) =>
    (val || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  useEffect(() => {
    const loadInitial = async () => {
      const [r, s] = await Promise.all([
        api.getSkillResults().catch(() => ({ data: null })),
        api.getSkillSessions().catch(() => ({ data: [] })),
      ]);
      setResult(r.data);
      setSessions(s.data || []);
      setLoadingInit(false);
    };
    loadInitial();
  }, []);

  const startQuiz = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.startSkillAssessment();
      setSession(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to start assessment');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (qId: string, val: string) => {
    setAnswers({ ...answers, [qId]: val });
  };

  const handleSubmit = async () => {
    if (!session) return;
    setLoading(true);
    setError('');
    const answersPayload = Object.keys(answers).map(key => ({
      question_id: key,
      user_answer: answers[key]
    }));

    try {
      const res = await api.submitSkillAssessment({
        session_id: session.session_id,
        answers: answersPayload
      });
      setResult(res.data);
      api.getSkillSessions().then((s) => setSessions(s.data || [])).catch(() => {});
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  sessionRef.current = session;
  qIndexRef.current = qIndex;
  submitRef.current = handleSubmit;

  useEffect(() => {
    if (!session || result || loading) return;
    timeoutHandledRef.current = false;
    setTimeLeft(60);
    const timer = setInterval(() => setTimeLeft((t) => (t > 0 ? t - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [session, result, loading, qIndex]);

  useEffect(() => {
    if (!session || result || loading || timeLeft !== 0) return;
    if (timeoutHandledRef.current) return;
    timeoutHandledRef.current = true;
    const total = sessionRef.current?.questions?.length || 0;
    if (qIndexRef.current >= total - 1) {
      submitRef.current();
    } else {
      setQIndex((i) => i + 1);
    }
  }, [timeLeft, session, result, loading]);

  const content = (
    <div className="fade-in">
      {/* Workspace Header */}
      <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="badge badge-primary">Skill Assessment</span>
          <span className="text-xs text-subtle">Adaptive Knowledge Check</span>
        </div>
        <h1 style={{ fontSize: '22px', marginBottom: '4px' }}>AI Technical Quiz</h1>
        <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
          Demonstrate practical competency with code completion, output prediction, and debugging questions.
        </p>
      </div>

      {error && <div className="alert alert-danger mb-4">{error}</div>}

      {/* ── Results View ── */}
      {/* ── Loading View ── */}
      {loadingInit ? (
        <div className="card text-center" style={{ padding: '32px' }}>
          <Loader2 size={22} className="spin" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Loading your results...</p>
        </div>
      ) : result ? (
        <div className="flex flex-col gap-6">
          <div className="card text-center" style={{ padding: '28px' }}>
            <CheckCircle2 size={30} color="var(--success)" style={{ margin: '0 auto 10px' }} />
            <h2 style={{ fontSize: '19px', marginBottom: '4px' }}>Quiz Completed</h2>
            <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
              {(result.skills || []).length} skills assessed
              {result.experience_level ? ` at ${titleCase(result.experience_level)} level` : ''}
              {result.completed_at ? ` · ${formatDate(result.completed_at)}` : ''}.
            </p>
          </div>

          <div className="grid-2 gap-4">
            {result.skills?.map((s: any, idx: number) => (
              <div key={idx} className="skill-evidence-card">
                <div>
                  <div className="card-header">
                    <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
                      <h4 style={{ fontSize: '14px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.name}
                      </h4>
                      <SkillBadge badge={getSkillBadge(s.name, passedSkillNames(result.skills), loadVerifiedSkills())} />
                    </div>
                  </div>

                  <p className="skill-result-evidence">{s.evidence_text}</p>
                </div>
              </div>
            ))}
          </div>

          {sessions.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title flex items-center gap-2">
                  <Clock size={15} color="var(--primary)" /> Previous Attempts
                </h3>
                <span className="badge badge-neutral">{sessions.length} total</span>
              </div>
              <div className="flex flex-col gap-2">
                {sessions.map((sess: any) => (
                  <div key={sess.id} className="flex items-center justify-between" style={{ padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '6px' }}>
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)' }}>
                        {formatDate(sess.completed_at || sess.submitted_at || sess.started_at)}
                      </span>
                      {sess.experience_level && (
                        <span className="badge badge-neutral">{titleCase(sess.experience_level)}</span>
                      )}
                    </div>
                    <span className={`badge ${statusBadge(sess.status)}`}>{titleCase(sess.status)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Link to="/dashboard" className="btn btn-primary btn-full btn-lg">
            Back to Dashboard
          </Link>
        </div>
      ) : !session ? (
        /* ── Start View ── */
        <div className="grid-sidebar gap-6 items-start mb-6">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title flex items-center gap-2">
                <BrainCircuit size={16} color="var(--primary)" /> Adaptive Question Engine
              </h3>
              <span className="badge badge-neutral">AI Generated</span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '20px' }}>
              The quiz dynamically builds 10 technical questions tailored directly to your declared stack (languages, frameworks, databases). Each question must be answered within 1 minute.
            </p>

            <button onClick={startQuiz} className="btn btn-primary btn-full btn-lg" disabled={loading}>
              {loading ? <><Loader2 size={15} className="spin" /> Generating Technical Questions...</> : <>Start Quiz Console <ArrowRight size={15} /></>}
            </button>
          </div>

          <div className="card card-sm">
            <div className="text-xs font-semibold text-text mb-2">Quiz Structure</div>
            <div className="flex flex-col gap-2 text-xs text-subtle" style={{ lineHeight: 1.5 }}>
              <div>• <strong>10 Questions:</strong> Covering your declared stack.</div>
              <div>• <strong>1 Minute Each:</strong> Unanswered questions score zero.</div>
              <div>• <strong>Mixed Formats:</strong> MCQ, code fill-ins, debugging & output prediction.</div>
            </div>
          </div>
        </div>
      ) : (
        /* ── Quiz Console (one question at a time) ── */
        (() => {
          const total = session.questions?.length || 0;
          const q = session.questions?.[qIndex];
          const answeredCount = Object.values(answers).filter((v: any) => v && v.trim?.() !== '').length;
          const progressPct = Math.round(((qIndex + 1) / total) * 100);

          return (
            <div className="flex flex-col gap-4">
              <div className="card" style={{ padding: '12px 16px' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-primary">Question {qIndex + 1} of {total}</span>
                  <span className={`badge ${timeLeft <= 10 ? 'badge-danger' : 'badge-neutral'}`} style={{ fontSize: '10px' }}>
                    <Timer size={12} style={{ marginRight: '4px' }} /> {timeLeft}s
                  </span>
                </div>
                <div style={{ height: '6px', background: 'var(--surface-2)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progressPct}%`, background: 'var(--primary)', transition: 'width 0.3s ease' }} />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-subtle">Answered {answeredCount}/{total}</span>
                  <span className="badge badge-neutral" style={{ fontSize: '10px' }}>{q?.type?.replace(/_/g, ' ').toUpperCase()}</span>
                </div>
              </div>

              {q && (
                <div className="card" key={q.id}>
                  <p style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.6, marginBottom: '14px', whiteSpace: 'pre-wrap' }}>
                    {q.question}
                  </p>

                  {q.code_snippet && (
                    <div className="code-block mb-4">
                      {q.code_snippet}
                    </div>
                  )}

                  {q.type === 'mcq' && q.options ? (
                    <div className="flex flex-col gap-2">
                      {Object.entries(q.options).map(([key, val]: [string, any]) => {
                        const isSelected = answers[q.id] === key;
                        return (
                          <label
                            key={key}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '10px 12px',
                              borderRadius: 'var(--radius)',
                              background: isSelected ? 'var(--primary-muted)' : 'var(--surface-2)',
                              border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                              cursor: 'pointer',
                              transition: 'all var(--transition)',
                              fontSize: '12px',
                              color: isSelected ? 'var(--text)' : 'var(--muted)',
                            }}
                          >
                            <input
                              type="radio"
                              name={`q_${q.id}`}
                              value={key}
                              checked={isSelected}
                              onChange={() => handleAnswerChange(q.id, key)}
                              style={{ accentColor: 'var(--primary)' }}
                            />
                            <span><strong style={{ color: 'var(--text)' }}>{key.toUpperCase()}.</strong> {val}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <textarea
                      className="form-control"
                      rows={3}
                      placeholder="Type your explanation or code answer here..."
                      value={answers[q.id] || ''}
                      onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                    />
                  )}

                  <div className="flex items-center justify-between mt-4">
                    <button onClick={() => setQIndex((i) => Math.max(0, i - 1))} disabled={qIndex === 0 || loading} className="btn btn-secondary">
                      <ArrowLeft size={14} /> Previous
                    </button>

                    {qIndex < total - 1 ? (
                      <button onClick={() => setQIndex((i) => i + 1)} disabled={loading} className="btn btn-primary">
                        Next <ArrowRight size={14} />
                      </button>
                    ) : (
                      <button onClick={handleSubmit} disabled={loading} className="btn btn-primary">
                        {loading ? <><Loader2 size={15} className="spin" /> Scoring Answers...</> : 'Submit All Answers'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()
      )}
    </div>
  );

  return <div className="main-workspace">{content}</div>;
};

export default SkillAssessment;
