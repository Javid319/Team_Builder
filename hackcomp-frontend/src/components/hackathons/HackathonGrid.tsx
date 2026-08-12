import { useEffect, useState } from 'react';
import { Loader2, CalendarClock } from 'lucide-react';
import type { Hackathon } from '../../types/hackathon';
import { getAllHackathons, getHackathonsByDomain } from '../../services/hackathonService';
import HackathonCard from './HackathonCard';

interface HackathonGridProps {
  limit?: number;
  domain?: string;
  showHeader?: boolean;
}

const HackathonGrid = ({ limit, domain, showHeader = true }: HackathonGridProps) => {
  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = domain
          ? getHackathonsByDomain(domain)
          : getAllHackathons();
        const list = await data;
        if (!cancelled) setHackathons(limit ? list.slice(0, limit) : list);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [domain, limit]);

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '160px' }}>
        <Loader2 size={22} className="spin" color="var(--primary)" />
      </div>
    );
  }

  if (!hackathons.length) {
    return (
      <div className="hack-grid-empty">
        <CalendarClock size={26} />
        <p>No hackathons found for this category yet.</p>
      </div>
    );
  }

  return (
    <div className="hack-section">
      {showHeader && (
        <div className="hack-section-head">
          <h3 className="card-title">Upcoming Hackathons</h3>
          <span className="badge badge-neutral">{hackathons.length} hackathons</span>
        </div>
      )}
      <div className="hack-grid">
        {hackathons.map((h) => <HackathonCard key={h.id} hackathon={h} />)}
      </div>
    </div>
  );
};

export default HackathonGrid;
