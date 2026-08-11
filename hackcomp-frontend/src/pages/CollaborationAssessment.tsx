import { useState } from 'react';
import { api } from '../api';

const CollaborationAssessment = () => {
  const [assessment, setAssessment] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const startQuiz = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.startCollabAssessment();
      setAssessment(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to start assessment');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (qId: string, val: number) => {
    setAnswers({ ...answers, [qId]: val });
  };

  const handleSubmit = async () => {
    if (!assessment) return;
    setLoading(true);
    setError('');
    const answersPayload = Object.keys(answers).map(key => ({
      question_id: key,
      response: answers[key]
    }));

    try {
      const res = await api.submitCollabAssessment({
        assessment_id: assessment.assessment_id,
        answers: answersPayload
      });
      setResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Results view ──
  if (result) {
    return (
      <div className="fade-in mt-4 glass-panel">
        <h2>Collaboration Profile Generated!</h2>
        <div className="dashboard-grid mt-3">
          {result.dimension_scores?.map((d: any) => (
            <div key={d.dimension} style={{ padding: '1rem', background: 'var(--surface-2)', borderRadius: '8px' }}>
              <div className="flex-between mb-1">
                <h4 style={{ textTransform: 'capitalize', color: 'var(--primary)', margin: 0 }}>
                  {d.dimension.replace(/_/g, ' ')}
                </h4>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{Math.round(d.percentage)}%</span>
              </div>
              <div style={{ height: '8px', width: '100%', background: 'var(--surface-border)', borderRadius: '4px', overflow: 'hidden', marginTop: '0.5rem' }}>
                <div style={{
                  height: '100%',
                  width: `${d.percentage}%`,
                  background: d.percentage >= 70 ? 'var(--success)' : d.percentage >= 40 ? '#eab230' : 'var(--danger)',
                  transition: 'width 0.6s ease'
                }} />
              </div>
              <div style={{ fontSize: '0.8rem', marginTop: '0.3rem', color: 'var(--text-main)' }}>
                Score: {d.raw_score} / {d.max_score}
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => { setResult(null); setAssessment(null); setAnswers({}); }} className="btn btn-outline mt-4">Retake Quiz</button>
      </div>
    );
  }

  // ── Start view ──
  if (!assessment) {
    return (
      <div className="fade-in mt-4 glass-panel flex-center" style={{ flexDirection: 'column', gap: '1rem', padding: '4rem 2rem' }}>
        <h2>Collaboration Style Quiz</h2>
        <p style={{ textAlign: 'center', maxWidth: '600px', color: 'var(--text-main)' }}>
          Evaluate your teamwork style across 6 dimensions: Leadership, Communication, Collaboration, Reliability, Adaptability, and Initiative.
        </p>
        {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}
        <button onClick={startQuiz} className="btn btn-primary mt-2" style={{ background: 'var(--success)' }} disabled={loading}>
          {loading ? 'Starting...' : 'Start Assessment'}
        </button>
      </div>
    );
  }

  // ── Quiz view ──
  const likertLabels: Record<number, string> = {
    1: 'Strongly Disagree',
    2: 'Disagree',
    3: 'Neutral',
    4: 'Agree',
    5: 'Strongly Agree'
  };

  return (
    <div className="fade-in mt-4">
      <h2 className="mb-3">Collaboration Quiz</h2>
      {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</div>}
      <div className="glass-panel">
        <p className="mb-4" style={{ color: 'var(--text-main)' }}>Rate each statement from 1 (Strongly Disagree) to 5 (Strongly Agree).</p>

        {assessment.questions?.map((q: any, idx: number) => (
          <div key={q.id} style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--surface-border)' }}>
            <div className="flex-between mb-1">
              <p style={{ fontSize: '1.05rem', color: 'var(--text-light)', margin: 0 }}>
                {idx + 1}. {q.question}
              </p>
              <span className="badge badge-info" style={{ whiteSpace: 'nowrap', marginLeft: '1rem' }}>
                {q.dimension?.replace(/_/g, ' ')}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
              {[1, 2, 3, 4, 5].map((val) => (
                <label key={val} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: '0.3rem',
                  padding: '0.5rem 0.75rem', borderRadius: '8px',
                  background: answers[q.id] === val ? 'rgba(69, 162, 158, 0.15)' : 'transparent',
                  border: `1px solid ${answers[q.id] === val ? 'var(--primary)' : 'var(--surface-border)'}`,
                  transition: 'all 0.2s ease',
                  minWidth: '60px'
                }}>
                  <input
                    type="radio"
                    name={`q_${q.id}`}
                    value={val}
                    checked={answers[q.id] === val}
                    onChange={() => handleAnswerChange(q.id, val)}
                    style={{ display: 'none' }}
                  />
                  <span style={{ fontSize: '1.1rem', fontWeight: 600, color: answers[q.id] === val ? 'var(--primary-hover)' : 'var(--text-main)' }}>{val}</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-main)', textAlign: 'center' }}>{likertLabels[val]}</span>
                </label>
              ))}
            </div>
          </div>
        ))}

        <button
          onClick={handleSubmit}
          className="btn btn-primary"
          disabled={loading || Object.keys(answers).length !== (assessment.questions?.length || 0)}
          style={{ width: '100%', background: 'var(--success)' }}
        >
          {loading ? 'Submitting...' : `Submit Answers (${Object.keys(answers).length}/${assessment.questions?.length || 0})`}
        </button>
      </div>
    </div>
  );
};

export default CollaborationAssessment;
