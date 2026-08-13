import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Compass, Handshake, UserPlus, Users } from 'lucide-react';
import { TEAM_GOAL_KEY, type TeamGoal } from '../types/team';

const GOAL_OPTIONS: { value: TeamGoal; title: string; desc: string; icon: React.ReactNode }[] = [
  {
    value: 'recruit',
    title: 'Looking for Members',
    desc: 'Create a team or grow an existing one. Browse candidates, send invites, and manage requests.',
    icon: <Users size={26} />,
  },
  {
    value: 'join',
    title: 'Looking to Join a Team',
    desc: 'Browse open teams, request to join, and track the status of your requests.',
    icon: <Handshake size={26} />,
  },
];

const TeamGoalPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselected = searchParams.get('goal');
  const [goal, setGoal] = useState<TeamGoal | null>(
    preselected === 'recruit' || preselected === 'join' ? preselected : null,
  );

  useEffect(() => {
    if (goal) return;
    const saved = localStorage.getItem(TEAM_GOAL_KEY);
    if (saved === 'recruit' || saved === 'join') setGoal(saved);
  }, [goal]);

  const selectGoal = (value: TeamGoal) => {
    localStorage.setItem(TEAM_GOAL_KEY, value);
    navigate(value === 'recruit' ? '/teams' : '/teams/browse');
  };

  return (
    <div className="main-workspace fade-in">
      <Link to="/dashboard" className="hack-detail-back">
        <ArrowLeft size={15} /> Back to Dashboard
      </Link>

      <div className="goal-head">
        <div className="goal-head-icon">
          <Compass size={24} />
        </div>
        <div>
          <span className="badge badge-primary">Team Formation</span>
          <h1 className="team-create-title">Choose Your Goal</h1>
          <p className="hack-detail-lede">How do you want to build your team? Pick a goal and we&apos;ll guide you through it.</p>
        </div>
      </div>

      <div className="goal-grid">
        {GOAL_OPTIONS.map((option) => {
          const active = goal === option.value;
          return (
            <button
              key={option.value}
              type="button"
              className={`goal-card ${active ? 'is-active' : ''}`}
              onClick={() => setGoal(option.value)}
            >
              <div className="goal-card-icon">
                {option.icon}
              </div>
              <h3 className="goal-card-title">{option.title}</h3>
              <p className="goal-card-desc">{option.desc}</p>
              <span className="goal-card-cta">
                {active ? 'Selected' : 'Select'} <ArrowRight size={14} />
              </span>
            </button>
          );
        })}
      </div>

      <div className="goal-footer">
        <button
          type="button"
          className="btn btn-primary btn-lg"
          disabled={!goal}
          onClick={() => goal && selectGoal(goal)}
        >
          <UserPlus size={16} /> Continue
        </button>
        <p className="goal-footer-note">You can change your goal later from any hackathon page.</p>
      </div>
    </div>
  );
};

export default TeamGoalPage;
