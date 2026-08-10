import { useEffect, useState } from 'react';
import { api } from '../api';

const LABELS: Record<number, string> = {
  1: 'Strongly disagree', 2: 'Disagree', 3: 'Neutral', 4: 'Agree', 5: 'Strongly agree',
};

const SCORE_LABELS: Record<string, string> = {
  openness_score: 'Openness',
  conscientiousness_score: 'Conscientiousness',
  extraversion_score: 'Extraversion',
  agreeableness_score: 'Agreeableness',
  neuroticism_score: 'Emotional resilience',
};

const PersonalityAssessment = () => {
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadQuestions = async () => {
    setError('');
    try {
      const response = await api.startPersonalityAssessment();
      setQuestions(response.data.questions || []);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Unable to load the personality assessment.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadQuestions(); }, []);

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const response = await api.submitPersonalityAssessment({
        answers: questions.map(question => ({ question_id: question.id, response: answers[question.id] })),
      });
      setResult(response.data.result);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Unable to evaluate your responses.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="main-workspace fade-in">Loading personality assessment…</div>;

  if (result) {
    return (
      <div className="main-workspace fade-in" style={{ maxWidth: '850px' }}>
        <div className="card">
          <span className="badge badge-success">Assessment complete</span>
          <h1 className="mt-2">Your team-style profile</h1>
          <p className="text-subtle">{result.collaboration_notes}</p>
          <div className="grid-4 gap-4 mt-4">
            {Object.entries(SCORE_LABELS).map(([key, label]) => (
              <div key={key} className="card card-sm">
                <div className="text-subtle text-xs">{label}</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--primary)' }}>{result[key]}%</div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <strong>Work style:</strong> {result.work_style}<br />
            <strong>Communication:</strong> {result.communication_style}<br />
            <strong>Suggested role:</strong> {result.preferred_role}
          </div>
          <button className="btn btn-secondary mt-4" onClick={() => { setAnswers({}); setResult(null); loadQuestions(); }}>Retake assessment</button>
        </div>
      </div>
    );
  }

  return (
    <div className="main-workspace fade-in" style={{ maxWidth: '850px' }}>
      <div className="mb-6">
        <span className="badge badge-primary">Personality assessment</span>
        <h1 className="mt-2">How do you work with a team?</h1>
        <p className="text-subtle">Answer all 12 statements honestly. Your results help improve team recommendations.</p>
      </div>
      {error && <div className="card mb-4" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>{error}</div>}
      <div className="card">
        {loading && <p className="text-subtle">Loading your 12 questions…</p>}
        {questions.map((question, index) => (
          <div key={question.id} style={{ padding: '20px 0', borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontWeight: 600 }}>{index + 1}. {question.question}</p>
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              {[1, 2, 3, 4, 5].map(value => (
                <label key={value} className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', borderColor: answers[question.id] === value ? 'var(--primary)' : undefined }}>
                  <input type="radio" name={question.id} checked={answers[question.id] === value} onChange={() => setAnswers({ ...answers, [question.id]: value })} style={{ display: 'none' }} />
                  {value} · {LABELS[value]}
                </label>
              ))}
            </div>
          </div>
        ))}
        <button className="btn btn-primary mt-4" style={{ width: '100%' }} disabled={loading || !questions.length || submitting || Object.keys(answers).length !== questions.length} onClick={submit}>
          {submitting ? 'Evaluating…' : `See my results (${Object.keys(answers).length}/${questions.length})`}
        </button>
      </div>
    </div>
  );
};

export default PersonalityAssessment;
