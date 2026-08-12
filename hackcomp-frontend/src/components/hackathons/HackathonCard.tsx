import { Link } from 'react-router-dom';
import {
  MapPin, Users, Trophy, CalendarDays, ArrowRight, Building2, Clock,
} from 'lucide-react';
import type { Hackathon, HackathonStatus } from '../../types/hackathon';

const formatPrize = (pool: number): string => {
  if (pool >= 1_000_000) return `$${(pool / 1_000_000).toFixed(pool % 1_000_000 ? 1 : 0)}M`;
  if (pool >= 1_000) return `$${(pool / 1_000).toFixed(pool % 1_000 ? 1 : 0)}K`;
  return `$${pool}`;
};

const formatParticipants = (n: number): string => {
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 ? 1 : 0)}K`;
  return String(n);
};

const formatDate = (iso: string): string =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const STATUS_META: Record<HackathonStatus, { label: string; className: string }> = {
  open: { label: 'Open', className: 'badge-success' },
  closing_soon: { label: 'Closing Soon', className: 'badge-warning' },
  closed: { label: 'Closed', className: 'badge-danger' },
};

const HackathonCard = ({ hackathon }: { hackathon: Hackathon }) => {
  const status = STATUS_META[hackathon.status] ?? STATUS_META.open;

  return (
    <article className="hack-card">
      <div className="hack-card-banner">
        <img src={hackathon.image_url} alt={hackathon.title} loading="lazy" />
        <span className={`badge hack-card-status ${status.className}`}>{status.label}</span>
        <span className="badge badge-primary hack-card-mode">{hackathon.mode}</span>
      </div>

      <div className="hack-card-body">
        <div className="hack-card-title-row">
          <h3 className="hack-card-title">{hackathon.title}</h3>
        </div>
        <p className="hack-card-organizer">
          <Building2 size={13} /> {hackathon.organizer}
        </p>
        <p className="hack-card-desc">{hackathon.short_description}</p>

        <div className="hack-card-tags">
          {hackathon.domains.map((domain) => (
            <span key={domain} className="skill-tag">{domain}</span>
          ))}
        </div>

        <div className="hack-card-stats">
          <div className="hack-card-stat">
            <Trophy size={14} />
            <span className="hack-card-stat-label">Prize</span>
            <span className="hack-card-stat-value">{formatPrize(hackathon.prize_pool)}</span>
          </div>
          <div className="hack-card-stat">
            <Users size={14} />
            <span className="hack-card-stat-label">Participants</span>
            <span className="hack-card-stat-value">{formatParticipants(hackathon.participants)}</span>
          </div>
          <div className="hack-card-stat">
            <CalendarDays size={14} />
            <span className="hack-card-stat-label">Deadline</span>
            <span className="hack-card-stat-value">{formatDate(hackathon.registration_deadline)}</span>
          </div>
        </div>

        <div className="hack-card-meta">
          <span><MapPin size={13} /> {hackathon.location}</span>
          <span><Clock size={13} /> Team {hackathon.team_size.min}-{hackathon.team_size.max}</span>
        </div>

        <div className="hack-card-actions">
          <Link to={`/hackathons/${hackathon.id}`} className="btn btn-outline btn-sm">
            View Details
          </Link>
          {hackathon.status === 'closed' ? (
            <button className="btn btn-secondary btn-sm btn-full" type="button" disabled>
              Closed for Registration
            </button>
          ) : (
            <Link to={`/hackathons/${hackathon.id}/team/create`} className="btn btn-primary btn-sm btn-full">
              Create Team <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
};

export default HackathonCard;
