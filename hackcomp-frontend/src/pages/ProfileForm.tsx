import React, { useState, useEffect } from 'react';
import { api } from '../api';
import SkillsManager from '../components/SkillsManager';
import AvatarUploader from '../components/AvatarUploader';
import { Loader2 } from 'lucide-react';

const WORK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const emptyForm = {
  name: '',
  college: '',
  degree: '',
  course: '',
  department: '',
  year_of_study: 1,
  experience_level: 'beginner',
  state: '',
  city: '',
  github_url: '',
  linkedin_url: '',
  leetcode_url: '',
};

const emptyAvailability = {
  working_days: [] as string[],
  working_hours: '',
  timezone: '',
  commitment_level: 'casual',
};

const ProfileForm = () => {
  const [formData, setFormData] = useState(emptyForm);
  const [availability, setAvailability] = useState(emptyAvailability);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [profileExists, setProfileExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.getProfile();
        if (res.data) {
          setFormData({
            name: res.data.name || '',
            college: res.data.college || '',
            degree: res.data.degree || '',
            course: res.data.course || '',
            department: res.data.department || '',
            year_of_study: res.data.year_of_study || 1,
            experience_level: res.data.experience_level || 'beginner',
            state: res.data.state || '',
            city: res.data.city || '',
            github_url: res.data.github_url || '',
            linkedin_url: res.data.linkedin_url || '',
            leetcode_url: res.data.leetcode_url || '',
          });
          setAvatarUrl(res.data.avatar_url || null);
          if (res.data.availability) {
            setAvailability({
              working_days: res.data.availability.working_days || [],
              working_hours: res.data.availability.working_hours || '',
              timezone: res.data.availability.timezone || '',
              commitment_level: res.data.availability.commitment_level || 'casual',
            });
          }
          setProfileExists(true);
        }
      } catch {
        setProfileExists(false);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setSaving(true);

    const payload: any = {
      ...formData,
      year_of_study: parseInt(formData.year_of_study.toString()),
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
        setMessage('Profile updated successfully.');
      } else {
        try {
          await api.createProfile(payload);
          setProfileExists(true);
          setMessage('Profile created successfully.');
        } catch (err: any) {
          if (err.response?.status === 409) {
            await api.updateProfile(payload);
            setProfileExists(true);
            setMessage('Profile updated successfully.');
          } else {
            throw err;
          }
        }
      }
      setMessageType('success');
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Failed to save profile.');
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <Loader2 size={24} className="spin" color="var(--primary)" />
      </div>
    );
  }

  return (
    <div className="page fade-in">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', marginBottom: '4px' }}>Developer Profile</h1>
        <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
          Manage your personal details, academic background, location, links, availability, and skills.
        </p>
      </div>

      <div className="grid-2 gap-6 items-start">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">{profileExists ? 'Edit Personal Information' : 'Create Profile'}</h3>
          </div>

          {message && (
            <div className={`alert ${messageType === 'success' ? 'alert-success' : 'alert-danger'} mb-4`}>
              {message}
            </div>
          )}

          <form onSubmit={handleSave}>
            <div className="form-group">
              <label className="form-label">Profile Picture</label>
              <AvatarUploader
                name={formData.name}
                avatarUrl={avatarUrl}
                onAvatarChange={setAvatarUrl}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input type="text" name="name" className="form-control" value={formData.name} onChange={handleChange} />
            </div>

            <div className="grid-3">
              <div className="form-group">
                <label className="form-label">College / University</label>
                <input type="text" name="college" className="form-control" value={formData.college} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Degree</label>
                <input type="text" name="degree" className="form-control" value={formData.degree} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Department</label>
                <input type="text" name="department" className="form-control" value={formData.department} onChange={handleChange} />
              </div>
            </div>

            <div className="grid-3">
              <div className="form-group">
                <label className="form-label">Year of Study</label>
                <input type="number" name="year_of_study" min="1" max="5" className="form-control" value={formData.year_of_study} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Experience Level</label>
                <select name="experience_level" className="form-control" value={formData.experience_level} onChange={handleChange}>
                  <option value="beginner">Beginner (&lt; 1 yr)</option>
                  <option value="intermediate">Intermediate (1-3 yrs)</option>
                  <option value="experienced">Experienced (3+ yrs)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Course</label>
                <input type="text" name="course" className="form-control" value={formData.course} onChange={handleChange} />
              </div>
            </div>

            <div className="divider" />

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">State</label>
                <input type="text" name="state" className="form-control" value={formData.state} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">City</label>
                <input type="text" name="city" className="form-control" value={formData.city} onChange={handleChange} />
              </div>
            </div>

            <div className="divider" />

            <div className="form-group">
              <label className="form-label">GitHub URL</label>
              <input type="url" name="github_url" className="form-control" placeholder="https://github.com/username" value={formData.github_url} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">LinkedIn URL</label>
              <input type="url" name="linkedin_url" className="form-control" placeholder="https://linkedin.com/in/username" value={formData.linkedin_url} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">LeetCode URL</label>
              <input type="url" name="leetcode_url" className="form-control" placeholder="https://leetcode.com/u/username" value={formData.leetcode_url} onChange={handleChange} />
            </div>

            <div className="divider" />

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
                  className="form-control"
                  placeholder="09:00-18:00"
                  value={availability.working_hours}
                  onChange={(e) => setAvailability({ ...availability, working_hours: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Timezone</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Asia/Kolkata"
                  value={availability.timezone}
                  onChange={(e) => setAvailability({ ...availability, timezone: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group mb-6">
              <label className="form-label">Commitment Level</label>
              <select
                className="form-control"
                value={availability.commitment_level}
                onChange={(e) => setAvailability({ ...availability, commitment_level: e.target.value })}
              >
                <option value="casual">Casual — a few hours/week</option>
                <option value="part_time">Part-time — 10-20 hrs/week</option>
                <option value="full_time">Full-time — 40+ hrs/week</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={saving}>
              {saving ? <><Loader2 size={15} className="spin" /> Saving...</> : 'Save Changes'}
            </button>
          </form>
        </div>

        <SkillsManager />
      </div>
    </div>
  );
};

export default ProfileForm;
