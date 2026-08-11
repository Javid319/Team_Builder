import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { ArrowRight, CheckCircle2, Loader2, RotateCcw, Sparkles, Users } from 'lucide-react';

const LIKERT = [1, 2, 3, 4, 5];

const LIKERT_LABELS: Record<number, string> = {
  1: 'Strongly disagree',
  2: 'Disagree',
  3: 'Neutral',
  4: 'Agree',
  5: 'Strongly agree',
};

const SCORE_LABELS: Record<string, string> = {
  openness_score: 'Openness',
  conscientiousness_score: 'Conscientiousness',
  extraversion_score: 'Extraversion',
  agreeableness_score: 'Agreeableness',
  neuroticism_score: 'Emotional resilience',
};

const TeamAssessment = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState<'info' | 'personality' | 'collaboration' | 'done'>('info');
  const [personQuestions, setPersonQuestions] = useState<any[]>([]);
  const [collabSession, setCollabSession] = useState<any>(null);
  const [personAnswers, setPersonAnswers] = useState<Record<string, number>>({});
  const [collabAnswers, setCollabAnswers] = useState<Record<string, number>>({});
  const [personResult, setPersonResult] = useState<any>(null);
  const [collabResult, setCollabResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [error, setError] = useState('');

  const startTest = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.startPersonalityAssessment();
      setPersonQuestions(res.data.questions || []);
      setStage('personality');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Unable to load Section 1.');
    } finally {
      setLoading(false);
    }
  };

  const submitPersonality = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await api.submitPersonalityAssessment({
        answers: personQuestions.map((q) => ({ question_id: q.id, response: personAnswers[q.id] })),
      });
      setPersonResult(res.data.result);
      const collabRes = await api.startCollabAssessment();
      setCollabSession(collabRes.data);
      setStage('collaboration');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Unable to finish Section 1.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitCollaboration = async () => {
    if (!collabSession) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await api.submitCollabAssessment({
        assessment_id: collabSession.assessment_id,
        answers: Object.keys(collabAnswers).map((qid) => ({ question_id: qid, response: collabAnswers[qid] })),
      });
      setCollabResult(res.data);
      setStage('done');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Unable to finish Section 2.');
    } finally {
      setSubmitting(false);
    }
  };

  const restart = () => {
    setStage('info');
    setPersonQuestions([]);
    setCollabSession(null);
    setPersonAnswers({});
    setCollabAnswers({});
    setPersonResult(null);
    setCollabResult(null);
    setError('');
  };

  const generateReportAndContinue = async () => {
    setGeneratingReport(true);
    try {
      await api.generateRecommendations();
    } catch {
      // AI report can be regenerated from the dashboard — still continue.
    }
    navigate('/dashboard');
  };

  if (stage === 'info') {
    return (
      <div className="main-workspace fade-in" style={{ maxWidth: '720px' }}>
        <div className="card text-center" style={{ padding: '40px 32px' }}>
          <span className="badge badge-primary">Team Evaluation</span>
          <h1 style={{ fontSize: '22px', marginTop: '16px', marginBottom: '8px' }}>Ready to be evaluated?</h1>
          <p className="text-subtle" style={{ maxWidth: '520px', margin: '0 auto', lineHeight: 1.6 }}>
            This test is made up of <strong>two sections</strong> that will be there to evaluate you.
            Complete both sections to promote the team recommendations.
          </p>

          <div className="grid-2 gap-3 mt-4" style={{ textAlign: 'left' }}>
            <div className="card card-sm">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} color="var(--primary)" />
                <strong style={{ fontSize: '13px' }}>Section 1 · Personal Style</strong>
              </div>
              <p className="text-subtle text-xs" style={{ lineHeight: 1.5 }}>
                12 short statements about how you approach work and handle situations.
              </p>
            </div>
            <div className="card card-sm">
              <div className="flex items-center gap-2 mb-2">
                <Users size={14} color="var(--primary)" />
                <strong style={{ fontSize: '13px' }}>Section 2 · Team Collaboration</strong>
              </div>
              <p className="text-subtle text-xs" style={{ lineHeight: 1.5 }}>
                12 statements about how you collaborate and communicate within a team.
              </p>
            </div>
          </div>

          {error && <div className="alert alert-danger mt-4">{error}</div>}

          <button onClick={startTest} className="btn btn-primary btn-full btn-lg mt-5" disabled={loading}>
            {loading ? <><Loader2 size={15} className="spin" /> Loading Section 1...</> : <>Start Test <ArrowRight size={15} /></>}
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'personality') {
    const answered = Object.keys(personAnswers).length;
    return (
      <div className="main-workspace fade-in" style={{ maxWidth: '850px' }}>
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="badge badge-primary">Section 1 of 2</span>
            <span className="text-xs text-subtle">Personal Style</span>
          </div>
          <h1 style={{ fontSize: '22px', marginBottom: '4px' }}>How do you work with a team?</h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
            Answer all {personQuestions.length} statements honestly to complete Section 1.
          </p>
        </div>

        {error && <div className="alert alert-danger mb-4">{error}</div>}

        <div className="card">
          {personQuestions.map((q, i) => (
            <div key={q.id} style={{ padding: '20px 0', borderBottom: i === personQuestions.length - 1 ? 'none' : '1px solid var(--border)' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, lineHeight: 1.6 }}>{i + 1}. {q.question}</p>
              <div className="flex gap-2 wrap">
                {LIKERT.map((v) => {
                  const selected = personAnswers[q.id] === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ cursor: 'pointer', borderColor: selected ? 'var(--primary)' : undefined, color: selected ? 'var(--primary)' : undefined }}
                      onClick={() => setPersonAnswers({ ...personAnswers, [q.id]: v })}
                    >
                      {v} · {LIKERT_LABELS[v]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <button onClick={submitPersonality} disabled={submitting || answered !== personQuestions.length} className="btn btn-primary btn-full btn-lg mt-4">
            {submitting ? <><Loader2 size={15} className="spin" /> Saving Section 1...</> : `Continue to Section 2 (${answered}/${personQuestions.length})`}
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'collaboration') {
    const answered = Object.keys(collabAnswers).length;
    const total = collabSession?.questions?.length || 0;
    return (
      <div className="main-workspace fade-in" style={{ maxWidth: '850px' }}>
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="badge badge-primary">Section 2 of 2</span>
            <span className="text-xs text-subtle">Team Collaboration</span>
          </div>
          <h1 style={{ fontSize: '22px', marginBottom: '4px' }}>How do you collaborate with a team?</h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
            Answer all {total} statements honestly to finish your evaluation.
          </p>
        </div>

        {error && <div className="alert alert-danger mb-4">{error}</div>}

        <div className="card">
          {collabSession?.questions?.map((q: any, i: number) => (
            <div key={q.id} style={{ padding: '20px 0', borderBottom: i === total - 1 ? 'none' : '1px solid var(--border)' }}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <p style={{ fontSize: '13px', fontWeight: 600, lineHeight: 1.6, margin: 0 }}>{i + 1}. {q.question}</p>
                {q.dimension && <span className="badge badge-neutral">{q.dimension.replace(/_/g, ' ')}</span>}
              </div>
              <div className="flex gap-2 wrap">
                {LIKERT.map((v) => {
                  const selected = collabAnswers[q.id] === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ cursor: 'pointer', borderColor: selected ? 'var(--primary)' : undefined, color: selected ? 'var(--primary)' : undefined }}
                      onClick={() => setCollabAnswers({ ...collabAnswers, [q.id]: v })}
                    >
                      {v} · {LIKERT_LABELS[v]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <button onClick={submitCollaboration} disabled={submitting || answered !== total} className="btn btn-primary btn-full btn-lg mt-4">
            {submitting ? <><Loader2 size={15} className="spin" /> Evaluating...</> : `Finish & See Results (${answered}/${total})`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="main-workspace fade-in" style={{ maxWidth: '850px' }}>
      <div className="card text-center mb-6" style={{ padding: '28px' }}>
        <CheckCircle2 size={30} color="var(--success)" style={{ margin: '0 auto 10px' }} />
        <h2 style={{ fontSize: '19px', marginBottom: '4px' }}>Test Complete</h2>
        <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
          Both sections evaluated. Your results help promote the team recommendations.
        </p>
      </div>

      <div className="card mb-6">
        <div className="card-header">
          <h3 className="card-title flex items-center gap-2">
            <Sparkles size={15} color="var(--primary)" /> Personal Style
          </h3>
        </div>
        {personResult && (
          <>
            <div className="grid-3 gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
              {Object.entries(SCORE_LABELS).map(([key, label]) => (
                <div key={key} className="card card-sm">
                  <div className="text-subtle text-xs">{label}</div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--primary)' }}>{personResult[key]}%</div>
                </div>
              ))}
            </div>
            <div className="text-xs text-subtle" style={{ lineHeight: 1.8 }}>
              <strong style={{ color: 'var(--text)' }}>Work style:</strong> {personResult.work_style}<br />
              <strong style={{ color: 'var(--text)' }}>Communication:</strong> {personResult.communication_style}<br />
              <strong style={{ color: 'var(--text)' }}>Suggested role:</strong> {personResult.preferred_role}
            </div>
          </>
        )}
      </div>

      <div className="card mb-6">
        <div className="card-header">
          <h3 className="card-title flex items-center gap-2">
            <Users size={15} color="var(--primary)" /> Team Collaboration
          </h3>
        </div>
        <div className="grid-2 gap-3">
          {collabResult?.dimension_scores?.map((d: any) => (
            <div key={d.dimension}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs" style={{ textTransform: 'capitalize', fontWeight: 600 }}>
                  {d.dimension.replace(/_/g, ' ')}
                </span>
                <span className="text-xs" style={{ fontWeight: 700 }}>{Math.round(d.percentage)}%</span>
              </div>
              <div style={{ height: '8px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${d.percentage}%`,
                  background: d.percentage >= 70 ? 'var(--success)' : d.percentage >= 40 ? '#f59e0b' : 'var(--danger)',
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={restart} className="btn btn-secondary">
          <RotateCcw size={14} /> Retake Test
        </button>
        <button onClick={generateReportAndContinue} disabled={generatingReport} className="btn btn-primary btn-full btn-lg">
          {generatingReport ? <><Loader2 size={15} className="spin" /> Generating AI report...</> : <><Sparkles size={15} /> Generate AI Report & Continue</>}
        </button>
      </div>
      <Link to="/dashboard" className="btn btn-ghost btn-sm mt-3" style={{ width: 'auto' }}>Skip — back to dashboard</Link>
    </div>
  );
};

export default TeamAssessment;
