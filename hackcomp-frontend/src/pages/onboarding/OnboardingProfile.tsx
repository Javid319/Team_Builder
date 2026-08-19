import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import {
  FileText, Loader2, Sparkles, User, ArrowRight, GraduationCap, MapPin, Link2, Clock, CalendarDays, Globe, Briefcase,
} from 'lucide-react';
import OnboardingLayout from '../../components/OnboardingLayout';
import AvatarUploader from '../../components/AvatarUploader';

const RESUME_ENGINE_URL = import.meta.env.VITE_RESUME_ENGINE_URL || 'http://localhost:8001';

const WORK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const WORKING_HOURS_OPTIONS = ['09:00-18:00', '10:00-19:00', '18:00-23:00', 'Flexible'];
const TIMEZONE_OPTIONS = [
  'UTC',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Dubai',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Australia/Sydney',
];

const emptyForm = {
  name: '',
  college: '',
  degree: '',
  course: '',
  department: '',
  year_of_study: '1',
  experience_level: 'beginner',
  role: '',
  state: '',
  city: '',
  github_url: '',
  linkedin_url: '',
  leetcode_url: '',
};

const ROLE_OPTIONS = [
  { value: 'backend_developer', label: 'Backend Developer' },
  { value: 'frontend_developer', label: 'Frontend Developer' },
  { value: 'fullstack_developer', label: 'Full Stack Developer' },
  { value: 'ml_engineer', label: 'ML Engineer' },
  { value: 'cloud_engineer', label: 'Cloud Engineer' },
  { value: 'devops_engineer', label: 'DevOps Engineer' },
  { value: 'mobile_developer', label: 'Mobile Developer' },
  { value: 'data_engineer', label: 'Data Engineer' },
  { value: 'cybersecurity', label: 'Cybersecurity' },
  { value: 'other', label: 'Other' },
];

const emptyAvailability = {
  working_days: [] as string[],
  working_hours: '',
  timezone: '',
  commitment_level: 'casual',
};

const OnboardingProfile = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState(emptyForm);
  const [availability, setAvailability] = useState(emptyAvailability);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileExists, setProfileExists] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoFillLoading, setAutoFillLoading] = useState(false);
  const [autoFillMessage, setAutoFillMessage] = useState('');

  // Prefill full name from the registered account
  useEffect(() => {
    api.getMe()
      .then((res) => {
        if (res.data?.full_name) {
          setFormData((prev) => ({ ...prev, name: prev.name || res.data.full_name }));
        }
      })
      .catch(() => {});
  }, []);

  // Prefill an existing profile (returning user who never finished onboarding)
  useEffect(() => {
    api.getProfile()
      .then((res) => {
        if (!res.data) return;
        const p = res.data;
        setFormData({
          name: p.name || '',
          college: p.college || '',
          degree: p.degree || '',
          course: p.course || '',
          department: p.department || '',
          year_of_study: (p.year_of_study || 1).toString(),
          experience_level: p.experience_level || 'beginner',
          role: p.role || '',
          state: p.state || '',
          city: p.city || '',
          github_url: p.github_url || '',
          linkedin_url: p.linkedin_url || '',
          leetcode_url: p.leetcode_url || '',
        });
        setProfileExists(true);
        setAvatarUrl(p.avatar_url || null);
        if (p.availability) {
          setAvailability({
            working_days: p.availability.working_days || [],
            working_hours: p.availability.working_hours || '',
            timezone: p.availability.timezone || '',
            commitment_level: p.availability.commitment_level || 'casual',
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const toggleDay = (day: string) => {
    setAvailability((prev) => ({
      ...prev,
      working_days: prev.working_days.includes(day)
        ? prev.working_days.filter((d) => d !== day)
        : [...prev.working_days, day],
    }));
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

    const payload: any = {
      name: formData.name,
      college: formData.college,
      degree: formData.degree,
      course: formData.course,
      department: formData.department,
      year_of_study: parseInt(formData.year_of_study, 10),
      experience_level: formData.experience_level,
      role: formData.role,
      state: formData.state,
      city: formData.city,
      github_url: formData.github_url,
      linkedin_url: formData.linkedin_url,
      leetcode_url: formData.leetcode_url,
      availability: {
        working_days: availability.working_days,
        working_hours: availability.working_hours,
        timezone: availability.timezone,
        commitment_level: availability.commitment_level,
      },
    };

    try {
      if (profileExists) {
        await api.updateProfile(payload);
      } else {
        await api.createProfile(payload);
      }
      localStorage.setItem('onboarding_step', 'skills');
      navigate('/onboarding/skills');
    } catch (err: any) {
      if (err.response?.status === 409) {
        try {
          await api.updateProfile(payload);
        } catch {
          // profile already contains the submitted data
        }
        localStorage.setItem('onboarding_step', 'skills');
        navigate('/onboarding/skills');
      } else {
        setError(err.response?.data?.detail || 'Failed to save profile.');
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
            <span className="badge badge-primary">Step 1 of 2</span>
            <span className="text-xs text-subtle">Create Your Developer Profile</span>
          </div>
          <h1 style={{ fontSize: '22px', marginBottom: '4px' }}>Developer Profile</h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
            Tell us about yourself, your location, professional links, and availability.
          </p>
        </div>

        {error && <div className="alert alert-danger mb-4">{error}</div>}

        {/* 2-Column Split Workspace */}
        <div className="grid-sidebar gap-6 items-start">

          {/* Main Form (Left 65%) */}
          <div className="flex flex-col gap-4">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* ── Personal Information ── */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title flex items-center gap-2">
                    <GraduationCap size={15} color="var(--primary)" /> Personal Information
                  </h3>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label className="form-label">Profile Picture</label>
                  <AvatarUploader
                    name={formData.name}
                    avatarUrl={avatarUrl}
                    onAvatarChange={setAvatarUrl}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input type="text" name="name" className="form-control" placeholder="Alex Morgan" value={formData.name} onChange={handleChange} />
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">College / University</label>
                    <input type="text" name="college" className="form-control" placeholder="Stanford University" value={formData.college} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Degree</label>
                    <input type="text" name="degree" className="form-control" placeholder="B.S." value={formData.degree} onChange={handleChange} />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <input type="text" name="department" className="form-control" placeholder="Computer Science" value={formData.department} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Year of Study</label>
                    <select name="year_of_study" className="form-control" value={formData.year_of_study} onChange={handleChange}>
                      <option value="1">1st Year</option>
                      <option value="2">2nd Year</option>
                      <option value="3">3rd Year</option>
                      <option value="4">4th Year</option>
                      <option value="5">Postgraduate</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Experience Level</label>
                  <select name="experience_level" className="form-control" value={formData.experience_level} onChange={handleChange}>
                    <option value="beginner">Beginner (&lt; 1 yr)</option>
                    <option value="intermediate">Intermediate (1-3 yrs)</option>
                    <option value="experienced">Experienced (3+ yrs)</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Role</label>
                  <select name="role" className="form-control" value={formData.role} onChange={handleChange}>
                    <option value="">Select a role (optional)</option>
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ── Location ── */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title flex items-center gap-2">
                    <MapPin size={15} color="var(--primary)" /> Location
                  </h3>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">State</label>
                    <input type="text" name="state" className="form-control" placeholder="California" value={formData.state} onChange={handleChange} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">City</label>
                    <input type="text" name="city" className="form-control" placeholder="San Francisco" value={formData.city} onChange={handleChange} />
                  </div>
                </div>
              </div>

              {/* ── Professional Links ── */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title flex items-center gap-2">
                    <Link2 size={15} color="var(--primary)" /> Professional Links
                  </h3>
                </div>

                <div className="form-group">
                  <label className="form-label">GitHub URL <span className="optional">(optional)</span></label>
                  <input type="url" name="github_url" className="form-control" placeholder="https://github.com/username" value={formData.github_url} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">LinkedIn URL <span className="optional">(optional)</span></label>
                  <input type="url" name="linkedin_url" className="form-control" placeholder="https://linkedin.com/in/username" value={formData.linkedin_url} onChange={handleChange} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">LeetCode URL <span className="optional">(optional)</span></label>
                  <input type="url" name="leetcode_url" className="form-control" placeholder="https://leetcode.com/u/username" value={formData.leetcode_url} onChange={handleChange} />
                </div>
              </div>

              {/* ── Availability ── */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title flex items-center gap-2">
                    <Clock size={15} color="var(--primary)" /> Availability
                  </h3>
                </div>

                <div className="form-group">
                  <label className="form-label">Working Days</label>
                  <div className="flex wrap gap-2">
                    {WORK_DAYS.map((day) => {
                      const selected = availability.working_days.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(day)}
                          className={`btn btn-sm ${selected ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ fontSize: '12px', padding: '4px 10px' }}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Working Hours</label>
                    <input
                      type="text"
                      list="working-hours-options"
                      name="working_hours"
                      className="form-control"
                      placeholder="09:00-18:00"
                      value={availability.working_hours}
                      onChange={(e) => setAvailability({ ...availability, working_hours: e.target.value })}
                    />
                    <datalist id="working-hours-options">
                      {WORKING_HOURS_OPTIONS.map((o) => <option key={o} value={o} />)}
                    </datalist>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Timezone</label>
                    <input
                      type="text"
                      list="timezone-options"
                      name="timezone"
                      className="form-control"
                      placeholder="Asia/Kolkata"
                      value={availability.timezone}
                      onChange={(e) => setAvailability({ ...availability, timezone: e.target.value })}
                    />
                    <datalist id="timezone-options">
                      {TIMEZONE_OPTIONS.map((o) => <option key={o} value={o} />)}
                    </datalist>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Commitment Level</label>
                  <select
                    name="commitment_level"
                    className="form-control"
                    value={availability.commitment_level}
                    onChange={(e) => setAvailability({ ...availability, commitment_level: e.target.value })}
                  >
                    <option value="casual">Casual — a few hours/week</option>
                    <option value="part_time">Part-time — 10-20 hrs/week</option>
                    <option value="full_time">Full-time — 40+ hrs/week</option>
                  </select>
                </div>
              </div>

              <button id="onboarding-save-profile-btn" type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
                {loading
                  ? <><Loader2 size={15} className="spin" /> Saving Profile...</>
                  : <>{profileExists ? 'Save & Continue' : 'Save & Continue'} <ArrowRight size={15} /></>}
              </button>
            </form>
          </div>

          {/* Right Sidebar (35%) */}
          <div className="flex flex-col gap-4">
            <div className="card" style={{ background: 'var(--surface-2)' }}>
              <div className="card-header">
                <h3 className="card-title flex items-center gap-2">
                  <Sparkles size={15} color="var(--primary)" /> AI Resume Auto-Fill
                </h3>
                <span className="badge badge-primary">BETA</span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '16px', lineHeight: 1.5 }}>
                Upload a PDF resume to automatically fill your college, degree, GitHub handle, and extract technical skills for the next step.
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

            <div className="card">
              <div className="card-header">
                <h3 className="card-title flex items-center gap-2">
                  <Briefcase size={15} color="var(--primary)" /> Onboarding Tips
                </h3>
              </div>
              <div className="flex flex-col gap-3 text-xs text-subtle" style={{ lineHeight: 1.5 }}>
                <div className="flex gap-2 items-start">
                  <User size={13} className="mt-0.5" />
                  <span>Location and availability help teams coordinate across timezones and schedules.</span>
                </div>
                <div className="flex gap-2 items-start">
                  <Globe size={13} className="mt-0.5" />
                  <span>Linking your GitHub profile unlocks automated repository verification.</span>
                </div>
                <div className="flex gap-2 items-start">
                  <CalendarDays size={13} className="mt-0.5" />
                  <span>Experience level is used to calibrate question difficulty during AI assessments.</span>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </OnboardingLayout>
  );
};

export default OnboardingProfile;
