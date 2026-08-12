// Types mirroring the backend `candidate_profiles.profile_data` JSONB contract
// (see platform_backend/app/services/candidate_profile_builder.py).
// Served by GET /api/v1/candidates (see platform_backend/app/api/routes/candidates.py).

export type CandidateRole =
  | 'backend_developer'
  | 'frontend_developer'
  | 'fullstack_developer'
  | 'ml_engineer'
  | 'cloud_engineer'
  | 'devops_engineer'
  | 'mobile_developer'
  | 'data_engineer'
  | 'cybersecurity'
  | 'other'
  | 'unknown';

export type CandidateExperience = 'beginner' | 'intermediate' | 'experienced' | 'unknown';

export type CommitmentLevel = 'casual' | 'part_time' | 'full_time';

export interface CandidateSkill {
  name: string;
  category?: string | null;
  source?: string;
  confidence_score?: number | null;
  confidence_level?: 'beginner' | 'intermediate' | 'advanced' | null;
}

export interface CandidateAvailability {
  working_days: string[];
  working_hours: string;
  timezone: string;
  commitment_level: CommitmentLevel;
}

export interface CandidateProfileData {
  ability: {
    skills: CandidateSkill[];
    skill_count?: number;
  };
  availability: CandidateAvailability;
  experience: { level: CandidateExperience };
  role: { role: CandidateRole };
}

export interface CandidateProfile {
  id: string;
  name: string;
  avatar_url: string | null;
  college: string | null;
  city: string | null;
  github_url: string | null;
  bio: string;
  profile_data: CandidateProfileData;
}

export interface CandidateFilters {
  search: string;
  roles: CandidateRole[];
  skills: string[];
  experience: CandidateExperience[];
  availability: CommitmentLevel[];
}

export interface InvitedMember {
  id: string;
  name: string;
  role: CandidateRole;
  skills: string[];
  commitment_level: CommitmentLevel;
}

export interface CreatedTeam {
  id: string;
  hackathon_id: string;
  hackathon_title: string;
  name: string;
  size: number;
  domains: string[];
  description: string;
  members: InvitedMember[];
  created_at: string;
}
