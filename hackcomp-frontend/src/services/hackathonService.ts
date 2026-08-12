import mockHackathons from '../data/mock_hackathons.json';
import type { Hackathon } from '../types/hackathon';

// ── Data source switch ────────────────────────────────────────
// Set USE_MOCK to false once GET /api/v1/hackathons is live.
// The UI components never know where the data comes from.
const USE_MOCK = true;

const API_URL = `${import.meta.env.VITE_SERVER_URL || 'http://localhost:8000'}/api/v1`;

const fetchFromApi = async <T>(path: string): Promise<T> => {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
  });
  if (!res.ok) throw new Error(`Hackathon API error: ${res.status}`);
  return res.json() as Promise<T>;
};

const mockFetch = async <T>(value: T): Promise<T> => {
  await new Promise((resolve) => setTimeout(resolve, 150));
  return value;
};

// ── Service API (stable — swap mock for real without touching UI) ──
export const getAllHackathons = async (): Promise<Hackathon[]> => {
  if (!USE_MOCK) return fetchFromApi<Hackathon[]>('/hackathons');
  return mockFetch<Hackathon[]>(mockHackathons as Hackathon[]);
};

export const getHackathonById = async (id: string): Promise<Hackathon | undefined> => {
  if (!USE_MOCK) return fetchFromApi<Hackathon>(`/hackathons/${id}`);
  return mockFetch<Hackathon | undefined>(
    (mockHackathons as Hackathon[]).find((h) => h.id === id),
  );
};

export const getHackathonsByDomain = async (domain: string): Promise<Hackathon[]> => {
  if (!USE_MOCK) return fetchFromApi<Hackathon[]>(`/hackathons?domain=${encodeURIComponent(domain)}`);
  return mockFetch<Hackathon[]>(
    (mockHackathons as Hackathon[]).filter((h) => h.domains.includes(domain)),
  );
};
