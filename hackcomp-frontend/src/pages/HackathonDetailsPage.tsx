import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { getAllHackathons, getHackathonById } from '../services/hackathonService';
import type { Hackathon, HackathonStatus } from '../types/hackathon';
import {
  ArrowLeft, ArrowRight, Building2, CalendarDays, CalendarClock, CalendarCheck,
  CalendarX, MapPin, Medal, Users, Trophy, Sparkles, Target, CheckCircle2, FileText,
  UsersRound, Wand2, Loader2, Hourglass,
} from 'lucide-react';

const STATUS_META: Record<HackathonStatus, { label: string; className: string }> = {
  open: { label: 'Open', className: 'badge-success' },
  closing_soon: { label: 'Closing Soon', className: 'badge-warning' },
  closed: { label: 'Closed', className: 'badge-danger' },
};

const formatPrize = (pool: number): string => {
  if (pool >= 1_000_000) return `$${(pool / 1_000_000).toFixed(pool % 1_000_000 ? 1 : 0)}M`;
  if (pool >= 1_000) return `$${(pool / 1_000).toFixed(pool % 1_000 ? 1 : 0)}K`;
  return `$${pool}`;
};

const formatParticipants = (n: number): string =>
  n >= 1_000 ? `${(n / 1_000).toFixed(n % 1_000 ? 1 : 0)}K` : String(n);

const formatDate = (iso: string): string =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const addDays = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

// Deterministic mock match score so it stays stable per hackathon
const mockMatchScore = (id: string): number => {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  return 72 + (Math.abs(hash) % 25); // 72–96
};

const mockSuggestedRole = (domains: string[]): string => {
  const map: Record<string, string> = {
    'AI/ML': 'Machine Learning Engineer',
    'Data Science': 'Data Scientist',
    'Web Development': 'Full Stack Developer',
    'Cloud': 'Cloud Engineer',
    'Cybersecurity': 'Security Analyst',
    'Blockchain/Web3': 'Blockchain Developer',
    'IoT': 'IoT Engineer',
    'FinTech': 'Backend Developer',
    'Healthcare': 'Health Tech Engineer',
    'Sustainability': 'Backend Developer',
  };
  return map[domains[0]] || 'Backend Developer';
};

const mockReasons = (domains: string[], skills: string[]): string[] => {
  const reasons: string[] = [];
  if (skills.length) {
    const hit = skills.find((s) => domains.some((d) => d.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(d.toLowerCase().split('/')[0])));
    reasons.push(hit ? `✓ ${hit} matches this hackathon` : `✓ ${skills[0]} is in demand here`);
  } else {
    reasons.push(`✓ ${domains[0]} matches your interests`);
  }
  reasons.push('✓ Strong analytical problem-solving skills');
  reasons.push('✓ Weekend availability confirmed');
  return reasons;
};

// Mock prize breakdown derived from the total pool
const prizeBreakdown = (pool: number): { label: string; amount: number; icon: 'gold' | 'silver' | 'bronze' }[] => [
  { label: '1st Place', amount: Math.round(pool * 0.5), icon: 'gold' },
  { label: '2nd Place', amount: Math.round(pool * 0.3), icon: 'silver' },
  { label: '3rd Place', amount: Math.round(pool * 0.2), icon: 'bronze' },
];

const HackathonDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const [hackathon, setHackathon] = useState<Hackathon | null>(null);
  const [similar, setSimilar] = useState<Hackathon[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [skills, setSkills] = useState<any[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [hack, all] = await Promise.all([getHackathonById(id || ''), getAllHackathons()]);
        if (cancelled) return;
        if (!hack) {
          setNotFound(true);
          return;
        }
        setHackathon(hack);
        setSimilar(
          all
            .filter((h) => h.id !== hack.id && h.domains.some((d) => hack.domains.includes(d)))
            .concat(all.filter((h) => h.id !== hack.id && !h.domains.some((d) => hack.domains.includes(d))))
            .slice(0, 3),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    api.getProfile().then((res) => setProfile(res.data)).catch(() => setProfile(null));
    api.getSkills().then((res) => setSkills(res.data || [])).catch(() => setSkills([]));
  }, []);

  const skillNames = useMemo(() => skills.map((s: any) => s.name), [skills]);
  const profileCompletion = useMemo(() => {
    if (!profile) return 0;
    let pct = 0;
    if (profile.name) pct += 15;
    if (profile.college) pct += 15;
    if (profile.degree) pct += 10;
    if (profile.department) pct += 10;
    if (profile.city) pct += 10;
    if (profile.experience_level) pct += 15;
    if (skillNames.length) pct += 25;
    return Math.min(pct, 100);
  }, [profile, skillNames]);

  if (loading) {
    return (
      <div className="main-workspace flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <Loader2 size={24} className="spin" color="var(--primary)" />
      </div>
    );
  }

  if (notFound || !hackathon) {
    return (
      <div className="main-workspace fade-in">
        <div className="hack-detail-notfound">
          <CalendarX size={32} />
          <h1>Hackathon not found</h1>
          <p className="text-subtle">The hackathon you're looking for doesn't exist.</p>
          <Link to="/dashboard" className="btn btn-primary btn-sm"><ArrowLeft size={14} /> Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const status = STATUS_META[hackathon.status];
  const matchScore = mockMatchScore(hackathon.id);
  const suggestedRole = profile?.role ? String(profile.role).replace(/_/g, ' ') : mockSuggestedRole(hackathon.domains);
  const reasons = mockReasons(hackathon.domains, skillNames);
  const prizes = prizeBreakdown(hackathon.prize_pool);
  const registrationOpens = addDays(hackathon.registration_deadline, -30);

  const timeline = [
    { label: 'Registration Opens', value: formatDate(registrationOpens), icon: CalendarCheck },
    { label: 'Registration Closes', value: formatDate(hackathon.registration_deadline), icon: CalendarX },
    { label: 'Hackathon Start', value: formatDate(hackathon.start_date), icon: CalendarDays },
    { label: 'Hackathon End', value: formatDate(hackathon.end_date), icon: CalendarClock },
  ];

  const heroStats = [
    { label: 'Prize Pool', value: formatPrize(hackathon.prize_pool), icon: Trophy },
    { label: 'Participants', value: formatParticipants(hackathon.participants), icon: Users },
    { label: 'Team Size', value: `${hackathon.team_size.min}-${hackathon.team_size.max}`, icon: UsersRound },
    { label: 'Deadline', value: formatDate(hackathon.registration_deadline), icon: Hourglass },
  ];

  return (
    <div className="main-workspace fade-in">

      {/* ── Back navigation ── */}
      <Link to="/dashboard" className="hack-detail-back">
        <ArrowLeft size={15} /> Back to Dashboard
      </Link>

      {/* ── 1. Hero ── */}
      <section className="hack-detail-hero">
        <div className="hack-detail-hero-banner">
          <img src={hackathon.image_url} alt={hackathon.title} />
          <span className={`badge hack-detail-hero-status ${status.className}`}>{status.label}</span>
        </div>
        <div className="hack-detail-hero-body">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="badge badge-primary">{hackathon.mode}</span>
            <span className="badge badge-neutral"><MapPin size={11} /> {hackathon.location}</span>
          </div>
          <h1 className="hack-detail-hero-title">{hackathon.title}</h1>
          <p className="hack-detail-hero-organizer">
            <Building2 size={15} /> {hackathon.organizer}
          </p>
          <p className="hack-detail-hero-sub">{hackathon.short_description}</p>

          <div className="hack-detail-stats">
            {heroStats.map((stat) => (
              <div key={stat.label} className="hack-detail-stat">
                <stat.icon size={16} />
                <span className="hack-detail-stat-label">{stat.label}</span>
                <span className="hack-detail-stat-value">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 2. Team Formation ── */}
      <section className="hack-detail-section">
        <h2 className="hack-detail-heading">Team Formation</h2>
        <p className="hack-detail-lede">Team up with the right people. Choose how you want to build your team.</p>

        <div className="hack-detail-team-grid">
          <div className="hack-detail-team-card">
            <div className="hack-detail-team-icon">
              <UsersRound size={22} />
            </div>
            <h3>Create Team (Regular)</h3>
            <p>Manually browse and invite teammates to join your hackathon project.</p>
            <Link to={`/hackathons/${hackathon.id}/team/create`} className="btn btn-primary btn-full">
              Start Regular Team <ArrowRight size={15} />
            </Link>
          </div>

          <div className="hack-detail-team-card hack-detail-team-card-accent">
            <span className="badge badge-warning hack-detail-team-reco">Recommended</span>
            <div className="hack-detail-team-icon" style={{ background: 'var(--warning-muted)', color: '#f59e0b' }}>
              <Wand2 size={22} />
            </div>
            <h3>Create Team (Blueprint)</h3>
            <p>Define your ideal team structure and receive recommended teammates.</p>
            <Link to={`/hackathons/${hackathon.id}/blueprint/create`} className="btn btn-primary btn-full">
              Start Blueprint Team <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 3. About + 4. Domains ── */}
      <section className="hack-detail-section">
        <h2 className="hack-detail-heading">About</h2>
        <p className="hack-detail-text">{hackathon.full_description}</p>

        <div className="hack-detail-domains">
          <h3 className="hack-detail-subheading">Domains</h3>
          <div className="flex wrap gap-2">
            {hackathon.domains.map((domain) => (
              <span key={domain} className="skill-tag">{domain}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. Timeline ── */}
      <section className="hack-detail-section">
        <h2 className="hack-detail-heading">Timeline</h2>
        <div className="hack-detail-timeline">
          {timeline.map((item, i) => (
            <div key={item.label} className={`hack-detail-timeline-item ${i === 3 ? 'is-last' : ''}`}>
              <div className="hack-detail-timeline-icon">
                <item.icon size={16} />
              </div>
              <div className="hack-detail-timeline-body">
                <span className="hack-detail-timeline-label">{item.label}</span>
                <span className="hack-detail-timeline-value">{item.value}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 6. Prizes ── */}
      <section className="hack-detail-section">
        <h2 className="hack-detail-heading">Prizes</h2>
        <div className="hack-detail-prizes">
          {prizes.map((prize) => (
            <div key={prize.label} className={`hack-detail-prize is-${prize.icon}`}>
              {prize.icon === 'gold' ? <Trophy size={22} /> : <Medal size={22} />}
              <span className="hack-detail-prize-label">{prize.label}</span>
              <span className="hack-detail-prize-value">{formatPrize(prize.amount)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── 7. Eligibility ── */}
      <section className="hack-detail-section">
        <h2 className="hack-detail-heading">Eligibility</h2>
        <ul className="hack-detail-eligibility">
          <li><CheckCircle2 size={15} /> Open to all developers — students and professionals</li>
          <li><CheckCircle2 size={15} /> Team size of {hackathon.team_size.min}-{hackathon.team_size.max} members required</li>
          <li><CheckCircle2 size={15} /> {hackathon.mode === 'Online' ? 'Fully remote participation' : hackathon.mode === 'Offline' ? 'On-site participation required' : 'Hybrid — attend online or on-site'}</li>
          <li><CheckCircle2 size={15} /> Registrations close on {formatDate(hackathon.registration_deadline)}</li>
          <li><CheckCircle2 size={15} /> A verified developer profile is recommended to get the best team matches</li>
        </ul>
      </section>

      {/* ── 8. For You ── */}
      <section className="hack-detail-section">
        <h2 className="hack-detail-heading">For You</h2>
        <div className="hack-detail-foryou">
          <div className="hack-detail-match">
            <span className="hack-detail-match-ring">
              <span>{matchScore}%</span>
            </span>
            <div>
              <span className="hack-detail-match-label">Match Score</span>
              <span className="hack-detail-match-sub">How well this hackathon fits you</span>
            </div>
          </div>

          <div className="hack-detail-foryou-main">
            <div className="hack-detail-foryou-block">
              <span className="hack-detail-foryou-label"><Target size={13} /> Suggested Role</span>
              <span className="hack-detail-foryou-value">{suggestedRole}</span>
            </div>

            <div className="hack-detail-foryou-block">
              <span className="hack-detail-foryou-label"><Wand2 size={13} /> Relevant Skills</span>
              <div className="flex wrap gap-2">
                {skillNames.length ? (
                  skillNames.slice(0, 6).map((name) => <span key={name} className="skill-tag">{name}</span>)
                ) : (
                  hackathon.domains.slice(0, 3).map((domain) => <span key={domain} className="skill-tag">{domain}</span>)
                )}
              </div>
            </div>

            <div className="hack-detail-foryou-block">
              <span className="hack-detail-foryou-label"><Sparkles size={13} /> Why this match</span>
              <ul className="hack-detail-reasons">
                {reasons.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
            </div>

            <div className="hack-detail-foryou-block">
              <span className="hack-detail-foryou-label"><FileText size={13} /> Profile Completion</span>
              <div className="hack-detail-foryou-progress">
                <div className="hack-detail-foryou-progress-track">
                  <div className="hack-detail-foryou-progress-fill" style={{ width: `${profileCompletion}%` }} />
                </div>
                <span className="hack-detail-foryou-progress-value">{profileCompletion}% complete</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 9. Similar Hackathons ── */}
      {similar.length > 0 && (
        <section className="hack-detail-section">
          <h2 className="hack-detail-heading">Similar Hackathons</h2>
          <div className="hack-detail-similar">
            {similar.map((h) => (
              <Link key={h.id} to={`/hackathons/${h.id}`} className="hack-detail-similar-card">
                <img src={h.image_url} alt={h.title} loading="lazy" />
                <div className="hack-detail-similar-body">
                  <h3>{h.title}</h3>
                  <p><Building2 size={12} /> {h.organizer}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="badge badge-neutral">{h.mode}</span>
                    <span className="badge badge-neutral">{formatPrize(h.prize_pool)} prize</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

    </div>
  );
};

export default HackathonDetailsPage;
