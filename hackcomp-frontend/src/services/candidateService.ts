import type {
  CandidateExperience,
  CandidateFilters,
  CandidateProfile,
  CandidateRole,
  CommitmentLevel,
} from '../types/candidate';

// ── API client ────────────────────────────────────────────────
// Candidates are served by GET /api/v1/candidates. Filtering happens
// server-side (role/skills/experience/availability) via PostgreSQL JSONB.
const API_URL = `${import.meta.env.VITE_SERVER_URL || 'http://localhost:8000'}/api/v1`;

const fetchFromApi = async <T>(path: string): Promise<T> => {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
  });
  if (!res.ok) throw new Error(`Candidate API error: ${res.status}`);
  return res.json() as Promise<T>;
};

const buildQuery = (filters?: CandidateFilters): string => {
  if (!filters) return '';
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set('search', filters.search.trim());
  if (filters.roles.length) params.set('role', filters.roles.join(','));
  if (filters.skills.length) params.set('skills', filters.skills.join(','));
  if (filters.experience.length) params.set('experience', filters.experience.join(','));
  if (filters.availability.length) params.set('availability', filters.availability.join(','));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
};

// ── Stable service API ────────────────────────────────────────
export const getCandidates = async (filters?: CandidateFilters): Promise<CandidateProfile[]> =>
  fetchFromApi<CandidateProfile[]>(`/candidates${buildQuery(filters)}`);

// ── Label + option helpers ────────────────────────────────────

export const ROLES: CandidateRole[] = [
  'backend_developer',
  'frontend_developer',
  'fullstack_developer',
  'ml_engineer',
  'cloud_engineer',
  'devops_engineer',
  'mobile_developer',
  'data_engineer',
  'cybersecurity',
  'other',
];

export const EXPERIENCE_LEVELS: CandidateExperience[] = ['beginner', 'intermediate', 'experienced'];

export const COMMITMENT_LEVELS: CommitmentLevel[] = ['casual', 'part_time', 'full_time'];

export const roleLabel = (role: CandidateRole | string): string =>
  role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const experienceLabel = (level: CandidateExperience | string): string =>
  level.charAt(0).toUpperCase() + level.slice(1);

export const commitmentLabel = (level: CommitmentLevel | string): string =>
  level.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** All skill names across candidates, sorted by frequency (most common first). */
export const allCandidateSkills = (candidates: CandidateProfile[]): string[] => {
  const counts = new Map<string, number>();
  for (const c of candidates) {
    for (const skill of c.profile_data.ability.skills) {
      counts.set(skill.name, (counts.get(skill.name) || 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
};
