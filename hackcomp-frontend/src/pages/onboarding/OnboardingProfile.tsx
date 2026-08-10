import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { FileText, Loader2, Sparkles, User, ArrowRight } from 'lucide-react';
import OnboardingLayout from '../../components/OnboardingLayout';

const RESUME_ENGINE_URL = 'http://localhost:8001';

const OnboardingProfile = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    college: '',
    degree: '',
    course: '',
    year_of_study: 1,
    experience_level: 'beginner',
    github_url: '',
    linkedin_url: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoFillLoading, setAutoFillLoading] = useState(false);
  const [autoFillMessage, setAutoFillMessage] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAutoFill = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setAutoFillMessage('Please upload a PDF file.');
      return;
    }

    setAutoFillLoading(true);
    setAutoFillMessage('Extracting information from resume...');

    try {
      const formPayload = new FormData();
      formPayload.append('file', file);

      const res = await fetch(`${RESUME_ENGINE_URL}/parse`, {
        method: 'POST',
        body: formPayload,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Resume parsing failed');
      }

      const data = await res.json();
      const profile = data.resume_profile || data;

      const updates: Partial<typeof formData> = {};
      if (profile.github_username) {
        updates.github_url = `https://github.com/${profile.github_username}`;
      }

      if (profile.education?.length) {
        const edu = profile.education[0];
        if (edu.institution) updates.college = edu.institution;
        if (edu.degree) updates.degree = edu.degree;
        if (edu.course) updates.course = edu.course;
      }

      if (profile.technical_skills?.length) {
        sessionStorage.setItem('autofill_skills', JSON.stringify(profile.technical_skills));
      }

      setFormData(prev => ({ ...prev, ...updates }));
      setAutoFillMessage(
        `Resume parsed! ${profile.technical_skills?.length || 0} skills detected for the next step.`
      );
    } catch (err: any) {
      setAutoFillMessage(`Failed to parse resume: ${err.message}. Please fill in manually.`);
    } finally {
      setAutoFillLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.createProfile({
        ...formData,
        year_of_study: parseInt(formData.year_of_study.toString()),
      });
      localStorage.setItem('onboarding_step', 'skills');
      navigate('/onboarding/skills');
    } catch (err: any) {
      if (err.response?.status === 409) {
        localStorage.setItem('onboarding_step', 'skills');
        navigate('/onboarding/skills');
      } else {
        setError(err.response?.data?.detail || 'Failed to create profile.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingLayout currentStep="profile">
      <div className="fade-in">
        {/* Workspace Header */}
        <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="badge badge-primary">Step 2 of 5</span>
            <span className="text-xs text-subtle">Personal & Academic Details</span>
          </div>
          <h1 style={{ fontSize: '22px', marginBottom: '4px' }}>Developer Profile</h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
            Complete your profile information or upload a resume to auto-extract fields.
          </p>
        </div>

        {error && <div className="alert alert-danger mb-4">{error}</div>}

        {/* 2-Column Split Workspace */}
        <div className="grid-sidebar gap-6 items-start">
          
          {/* Main Form (Left 65%) */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title flex items-center gap-2">
                <User size={15} color="var(--primary)" /> Basic Profile Information
              </h3>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label">College / University</label>
                  <input type="text" name="college" className="form-control" placeholder="Stanford University" value={formData.college} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">Degree</label>
                  <input type="text" name="degree" className="form-control" placeholder="B.S." value={formData.degree} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">Course</label>
                  <input type="text" name="course" className="form-control" placeholder="Computer Science" value={formData.course} onChange={handleChange} />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Year of Study</label>
                  <select name="year_of_study" className="form-control" value={formData.year_of_study} onChange={handleChange}>
                    <option value={1}>1st Year</option>
                    <option value={2}>2nd Year</option>
                    <option value={3}>3rd Year</option>
                    <option value={4}>4th Year</option>
                    <option value={5}>Postgraduate</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Experience Level</label>
                  <select name="experience_level" className="form-control" value={formData.experience_level} onChange={handleChange}>
                    <option value="beginner">Beginner (&lt; 1 yr)</option>
                    <option value="intermediate">Intermediate (1-3 yrs)</option>
                    <option value="advanced">Experienced (3+ yrs)</option>
                  </select>
                </div>
              </div>

              <div className="divider" />

              <div className="form-group">
                <label className="form-label">GitHub Profile URL <span className="optional">(optional)</span></label>
                <input type="url" name="github_url" className="form-control" placeholder="https://github.com/username" value={formData.github_url} onChange={handleChange} />
              </div>

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label">LinkedIn Profile URL <span className="optional">(optional)</span></label>
                <input type="url" name="linkedin_url" className="form-control" placeholder="https://linkedin.com/in/username" value={formData.linkedin_url} onChange={handleChange} />
              </div>

              <button id="onboarding-save-profile-btn" type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
                {loading ? <><Loader2 size={15} className="spin" /> Saving Profile...</> : <>Save & Continue <ArrowRight size={15} /></>}
              </button>
            </form>
          </div>

          {/* AI Auto-fill Panel (Right 35%) */}
          <div className="flex flex-col gap-4">
            <div className="card" style={{ background: 'var(--surface-2)' }}>
              <div className="card-header">
                <h3 className="card-title flex items-center gap-2">
                  <Sparkles size={15} color="var(--primary)" /> AI Resume Auto-Fill
                </h3>
                <span className="badge badge-primary">BETA</span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '16px', lineHeight: 1.5 }}>
                Upload a PDF resume to automatically fill your college, degree, course, GitHub handle, and extract technical skills for the next step.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                style={{ display: 'none' }}
                onChange={handleFileSelected}
              />

              <button
                type="button"
                onClick={handleAutoFill}
                disabled={autoFillLoading}
                className="btn btn-secondary btn-full"
                style={{ borderStyle: 'dashed' }}
              >
                {autoFillLoading ? <Loader2 size={14} className="spin" /> : <FileText size={14} />}
                {autoFillLoading ? 'Parsing Resume PDF...' : 'Upload PDF Resume'}
              </button>

              {autoFillMessage && (
                <div className={`alert ${autoFillMessage.includes('parsed') ? 'alert-success' : 'alert-danger'} mt-3`} style={{ fontSize: '11px', padding: '8px 10px' }}>
                  {autoFillMessage}
                </div>
              )}
            </div>

            <div className="card card-sm">
              <div className="text-xs font-semibold text-text mb-2">Tips for profile setup</div>
              <div className="flex flex-col gap-2 text-xs text-subtle" style={{ lineHeight: 1.5 }}>
                <div>• Linking your GitHub profile unlocks automated repository verification.</div>
                <div>• Experience level is used to calibrate question difficulty during AI assessments.</div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </OnboardingLayout>
  );
};

export default OnboardingProfile;
