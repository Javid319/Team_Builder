import { useState } from 'react';
import { api } from '../api';
import { BrainCircuit, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import OnboardingLayout from '../components/OnboardingLayout';

interface SkillAssessmentProps {
  onComplete?: () => void;
}

const SkillAssessment = ({ onComplete }: SkillAssessmentProps) => {
  const [session, setSession] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

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
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    if (onComplete) {
      onComplete();
    } else {
      setResult(null);
      setSession(null);
      setAnswers({});
    }
  };

  const content = (
    <div className={`fade-in ${onComplete ? 'assessment-content' : ''}`}>
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
      {result ? (
        <div className="flex flex-col gap-6">
          <div className="card text-center" style={{ padding: '32px' }}>
            <CheckCircle2 size={32} color="var(--success)" style={{ margin: '0 auto 12px' }} />
            <h2 style={{ fontSize: '20px', marginBottom: '6px' }}>Quiz Completed</h2>
            <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
              Your answers have been scored and confidence badges attached to your profile.
            </p>
          </div>

          <div className="grid-2 gap-4">
            {result.skills?.map((s: any, idx: number) => (
              <div key={idx} className="card flex flex-col justify-between">
                <div>
                  <div className="card-header">
                    <h4 style={{ fontSize: '14px', color: 'var(--text)' }}>{s.name}</h4>
                    <span className={`badge ${s.confidence_level === 'high' ? 'badge-success' : s.confidence_level === 'medium' ? 'badge-warning' : 'badge-primary'}`}>
                      {s.confidence_level.toUpperCase()} — {Math.round(s.confidence_score)}%
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5 }}>{s.evidence_text}</p>
                </div>
              </div>
            ))}
          </div>

          <button onClick={handleFinish} className="btn btn-primary btn-full btn-lg">
            {onComplete ? <>Complete Setup & View Dashboard <ArrowRight size={15} /></> : 'Take Quiz Again'}
          </button>
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
              The quiz dynamically builds 3-5 technical questions tailored directly to your declared stack (languages, frameworks, databases).
            </p>

            <button onClick={startQuiz} className="btn btn-primary btn-full btn-lg" disabled={loading}>
              {loading ? <><Loader2 size={15} className="spin" /> Generating Technical Questions...</> : <>Start Quiz Console <ArrowRight size={15} /></>}
            </button>
          </div>

          <div className="card card-sm">
            <div className="text-xs font-semibold text-text mb-2">Quiz Structure</div>
            <div className="flex flex-col gap-2 text-xs text-subtle" style={{ lineHeight: 1.5 }}>
              <div>• <strong>Multiple Choice:</strong> Core concept verification.</div>
              <div>• <strong>Code Analysis:</strong> Output prediction & debugging.</div>
              <div>• <strong>Untimed:</strong> Work at your own pace.</div>
            </div>
          </div>
        </div>
      ) : (
        /* ── Quiz Console (Split IDE View) ── */
        <div className="grid-sidebar gap-6 items-start mb-6">
          {/* Question Feed (Left 70%) */}
          <div className="flex flex-col gap-4">
            {session.questions?.map((q: any, idx: number) => (
              <div key={q.id} className="card" id={`q-card-${idx}`}>
                <div className="card-header mb-2">
                  <span className="text-xs font-semibold text-primary">Question {idx + 1} of {session.questions.length}</span>
                  <span className="badge badge-neutral" style={{ fontSize: '10px' }}>{q.type?.replace(/_/g, ' ').toUpperCase()}</span>
                </div>

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
              </div>
            ))}

            <button
              onClick={handleSubmit}
              className="btn btn-primary btn-full btn-lg mt-2"
              disabled={loading || Object.values(answers).filter(val => val.trim() !== '').length !== (session.questions?.length || 0)}
            >
              {loading ? <><Loader2 size={15} className="spin" /> Scoring Answers...</> : `Submit All Answers (${Object.values(answers).filter(val => val.trim() !== '').length}/${session.questions?.length || 0})`}
            </button>
          </div>

          {/* Question Navigator Panel (Right 30%) */}
          <div className="card sticky-panel">
            <div className="card-header mb-3">
              <h3 className="card-title text-xs">Question Navigator</h3>
              <span className="badge badge-neutral">
                {Object.values(answers).filter(val => val.trim() !== '').length}/{session.questions?.length || 0}
              </span>
            </div>

            <div className="flex wrap gap-2 mb-4">
              {session.questions?.map((q: any, idx: number) => {
                const answered = !!answers[q.id]?.trim();
                return (
                  <a
                    key={q.id}
                    href={`#q-card-${idx}`}
                    className={`btn btn-sm ${answered ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ width: '36px', height: '36px', padding: 0 }}
                  >
                    {idx + 1}
                  </a>
                );
              })}
            </div>

            <div className="text-xs text-subtle" style={{ lineHeight: 1.5 }}>
              Complete all questions to enable answer submission.
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (onComplete) {
    return <OnboardingLayout currentStep="assessment">{content}</OnboardingLayout>;
  }

  return <div className="main-workspace">{content}</div>;
};

export default SkillAssessment;
