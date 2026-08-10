import React, { useState, useEffect } from 'react';
import { api } from '../api';
import SkillsManager from '../components/SkillsManager';
import { Loader2 } from 'lucide-react';

const ProfileForm = () => {
  const [formData, setFormData] = useState({
    college: '',
    degree: '',
    course: '',
    year_of_study: 1,
    experience_level: 'beginner',
    github_url: '',
    linkedin_url: ''
  });
  const [message, setMessage] = useState('');
  const [profileExists, setProfileExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.getProfile();
        if (res.data) {
          setFormData({
            college: res.data.college || '',
            degree: res.data.degree || '',
            course: res.data.course || '',
            year_of_study: res.data.year_of_study || 1,
            experience_level: res.data.experience_level || 'beginner',
            github_url: res.data.github_url || '',
            linkedin_url: res.data.linkedin_url || ''
          });
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setSaving(true);
    try {
      if (profileExists) {
        await api.updateProfile({
          ...formData,
          year_of_study: parseInt(formData.year_of_study.toString())
        });
        setMessage('Profile updated successfully.');
      } else {
        await api.createProfile({
          ...formData,
          year_of_study: parseInt(formData.year_of_study.toString())
        });
        setMessage('Profile created successfully.');
        setProfileExists(true);
      }
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Failed to save profile.');
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
          Manage your personal details, academic background, and skills.
        </p>
      </div>

      <div className="grid-2 gap-6 items-start">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">{profileExists ? 'Edit Personal Information' : 'Create Profile'}</h3>
          </div>

          {message && (
            <div className={`alert ${message.includes('successfully') ? 'alert-success' : 'alert-danger'} mb-4`}>
              {message}
            </div>
          )}

          <form onSubmit={handleSave}>
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
                <label className="form-label">Course</label>
                <input type="text" name="course" className="form-control" value={formData.course} onChange={handleChange} />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Year of Study</label>
                <input type="number" name="year_of_study" min="1" max="5" className="form-control" value={formData.year_of_study} onChange={handleChange} />
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
              <label className="form-label">GitHub URL</label>
              <input type="url" name="github_url" className="form-control" placeholder="https://github.com/username" value={formData.github_url} onChange={handleChange} />
            </div>
            <div className="form-group mb-6">
              <label className="form-label">LinkedIn URL</label>
              <input type="url" name="linkedin_url" className="form-control" placeholder="https://linkedin.com/in/username" value={formData.linkedin_url} onChange={handleChange} />
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
