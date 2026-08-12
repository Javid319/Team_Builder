export type HackathonMode = 'Online' | 'Offline' | 'Hybrid';
export type HackathonStatus = 'open' | 'closing_soon' | 'closed';

export interface HackathonTeamSize {
  min: number;
  max: number;
}

export interface Hackathon {
  id: string;
  title: string;
  organizer: string;
  mode: HackathonMode;
  image_url: string;
  short_description: string;
  full_description: string;
  domains: string[];
  prize_pool: number;
  participants: number;
  registration_deadline: string; // YYYY-MM-DD
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  team_size: HackathonTeamSize;
  location: string;
  status: HackathonStatus;
}
