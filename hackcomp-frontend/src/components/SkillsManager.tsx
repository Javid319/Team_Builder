import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Plus, X, Loader2 } from 'lucide-react';

const SkillsManager = () => {
  const [skills, setSkills] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [level, setLevel] = useState('beginner');
  const [adding, setAdding] = useState(false);

  const fetchSkills = async () => {
    try {
      const res = await api.getSkills();
      setSkills(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSkills();
    const interval = setInterval(fetchSkills, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || adding) return;
    setAdding(true);
    try {
      await api.addSkill({ name: name.trim(), level });
      setName('');
      await fetchSkills();
    } catch (err) {
      console.error('Failed to add skill');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteSkill(id);
      fetchSkills();
    } catch (err) {
      console.error('Failed to delete skill');
    }
  };

  const getSourceBadgeClass = (source?: string) => {
    switch (source) {
      case 'github': return 'badge-github';
      case 'resume': return 'badge-resume';
      case 'assessment': return 'badge-assessment';
      default: return 'badge-manual';
    }
  };

  // Deduplicate skills by normalized name for display safety
  const displaySkills = skills.filter((s, idx, self) => 
    idx === self.findIndex((t) => t.name.trim().toLowerCase() === s.name.trim().toLowerCase())
  );

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Technical Skills</h3>
        <span className="badge badge-neutral">{displaySkills.length} added</span>
      </div>

      <form onSubmit={handleAdd} className="flex gap-2 mb-4 skills-form">
        <input 
          id="add-skill-input"
          type="text" 
          placeholder="Skill name (e.g. React, Python, AWS)" 
          className="form-control" 
          value={name} 
          onChange={e => setName(e.target.value)} 
          style={{ flex: 1, minWidth: 0 }}
        />
        <select 
          className="form-control" 
          value={level} 
          onChange={e => setLevel(e.target.value)} 
          style={{ width: '130px', flexShrink: 0 }}
        >
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
        <button id="add-skill-btn" type="submit" className="btn btn-primary" disabled={adding || !name.trim()}>
          {adding ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
          Add
        </button>
      </form>

      <div className="flex wrap gap-2" style={{ minHeight: '40px' }}>
        {displaySkills.map((s, idx) => (
          <div key={s.id || idx} className="skill-tag">
            <span>{s.name}</span>
            <span className={`badge ${getSourceBadgeClass(s.source)}`} style={{ fontSize: '10px', padding: '1px 5px' }}>
              {s.source || s.level}
            </span>
            <button 
              type="button"
              onClick={() => handleDelete(s.id)}
              className="skill-tag-remove"
              title="Remove skill"
            >
              <X size={13} />
            </button>
          </div>
        ))}
        {displaySkills.length === 0 && (
          <div className="text-subtle text-sm" style={{ padding: '12px 0' }}>
            No skills added yet. Type a skill name above or upload a resume to auto-extract.
          </div>
        )}
      </div>
    </div>
  );
};

export default SkillsManager;
