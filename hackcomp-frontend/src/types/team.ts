// Types mirroring the backend Team Formation module
// (see platform_backend/app/schemas/team.py).

export type TeamStatus = 'OPEN' | 'FULL' | 'LOCKED';
export type TeamMemberRole = 'OWNER' | 'MEMBER';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
export type JoinRequestStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

// ── Team ──────────────────────────────────────────────────────
export interface TeamMemberOut {
  id: string;
  user_id: string;
  role: TeamMemberRole;
  joined_at: string;
  name: string | null;
  email: string | null;
}

export interface TeamOut {
  id: string;
  name: string;
  description: string | null;
  domains: string[];
  owner_id: string;
  max_members: number;
  status: TeamStatus;
  created_at: string;
  updated_at: string;
  members: TeamMemberOut[];
  member_count: number;
  owner: TeamMemberOut | null;
}

export interface TeamListOwnerOut {
  id: string;
  name: string | null;
  email: string | null;
}

export interface TeamListItem {
  id: string;
  name: string;
  description: string | null;
  domains: string[];
  status: TeamStatus;
  max_members: number;
  current_size: number;
  open_slots: number;
  owner: TeamListOwnerOut | null;
}

export interface TeamListResponse {
  items: TeamListItem[];
  total: number;
  page: number;
  page_size: number;
}

// ── Join requests ─────────────────────────────────────────────
export interface JoinRequestUserOut {
  id: string;
  name: string | null;
  email: string | null;
  college: string | null;
  role: string | null;
}

export interface JoinRequestTeamOut {
  id: string;
  name: string;
  domains: string[];
  status: TeamStatus;
  member_count: number;
  max_members: number;
}

export interface JoinRequestOut {
  id: string;
  team_id: string;
  user_id: string;
  status: JoinRequestStatus;
  created_at: string;
  team: JoinRequestTeamOut | null;
  user: JoinRequestUserOut | null;
}

// ── Invitations ───────────────────────────────────────────────
export interface InvitationUserOut {
  id: string;
  name: string | null;
  email: string | null;
}

export interface InvitationTeamOut {
  id: string;
  name: string;
  domains: string[];
  status: TeamStatus;
  member_count: number;
  max_members: number;
}

export interface InvitationOut {
  id: string;
  team_id: string;
  sender_id: string;
  receiver_id: string;
  status: InvitationStatus;
  created_at: string;
  expires_at: string | null;
  team: InvitationTeamOut | null;
  sender: InvitationUserOut | null;
  receiver: InvitationUserOut | null;
}

// ── Member recommendations ────────────────────────────────────
export interface MemberRecommendation {
  user_id: string;
  name: string;
  avatar_url: string | null;
  college: string | null;
  city: string | null;
  github_url: string | null;
  bio: string;
  role: string;
  skills: string[];
  experience_level: string;
  commitment_level: string;
  profile_strength: number;
  compatibility_score: number;
  domain_match: string[];
  assessment_compatibility: number;
  skill_overlap: string[];
}

// ── Goal selection (frontend preference, not a backend model) ──
export type TeamGoal = 'recruit' | 'join';

export const TEAM_GOAL_KEY = 'hackcomp_goal';

export const TEAM_DOMAINS = [
  'AI/ML',
  'Data Science',
  'Web Development',
  'Cloud',
  'DevOps',
  'Cybersecurity',
  'Blockchain/Web3',
  'Mobile',
  'IoT',
  'FinTech',
  'UI/UX',
  'Open Source',
];
