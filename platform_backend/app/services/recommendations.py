"""
Member discovery (Looking for Members) — GET /recommendations/members.

Ranks discoverable candidates for a team on a 0–100 compatibility score:

    domain compatibility       (30)  — candidate role's domains vs team.domains
    assessment compatibility   (30)  — behavior (personality) + teamwork signals
    skill compatibility        (40)  — candidate skills ∩ team aggregate skills

Excluded:
  * current team members
  * users already in a FULL team
  * users with a PENDING invitation for this team
"""
from __future__ import annotations

import uuid
from typing import Dict, List, Optional, Set

from sqlalchemy.orm import Session

from app.models.candidate_profile import CandidateProfile
from app.models.profile import Profile
from app.models.team import InvitationStatus, Team, TeamMember, TeamStatus
from app.models.user import User
from app.schemas.team import MemberRecommendation
from app.services.team import TeamNotFoundError, get_team_by_id

DOMAIN_WEIGHT = 30
ASSESSMENT_WEIGHT = 30
SKILL_WEIGHT = 40

# Candidate role -> hackathon domains it typically covers. Used for domain
# matching since candidates declare a role, not explicit domains.
ROLE_DOMAINS: Dict[str, Set[str]] = {
    "ml_engineer": {"AI/ML", "Data Science"},
    "data_engineer": {"Data Science", "AI/ML"},
    "backend_developer": {"Web Development"},
    "frontend_developer": {"Web Development", "UI/UX"},
    "fullstack_developer": {"Web Development", "UI/UX"},
    "cloud_engineer": {"Cloud", "DevOps"},
    "devops_engineer": {"Cloud", "DevOps"},
    "cybersecurity": {"Cybersecurity"},
    "mobile_developer": {"Mobile", "IoT"},
    "other": set(),
    "unknown": set(),
}


class RecommendationError(Exception):
    """Base class for recommendation service domain errors."""


class NoActiveTeamError(RecommendationError):
    """The requesting user is not part of any active team."""


class NotTeamMemberError(RecommendationError):
    """The requesting user is not a member of the requested team."""


def _normalize(value: str) -> str:
    return value.strip().lower()


def _match_domains(
    team_domains: List[str], candidate_domains: Set[str]
) -> List[str]:
    """Team domains that overlap the candidate's role domains (case-insensitive)."""
    matches: List[str] = []
    for td in team_domains:
        t = _normalize(td)
        if not t:
            continue
        for cd in candidate_domains:
            c = _normalize(cd)
            if not c:
                continue
            if c == t or c in t or t in c:
                matches.append(td)
                break
    return matches


def _assessment_compatibility(data: Dict) -> int:
    """0-30: personality (behavior) and teamwork (collaboration) signals."""
    behavior = data.get("behavior") or {}
    teamwork = data.get("teamwork") or {}

    behavior_done = bool(behavior.get("big_five") or behavior.get("strengths"))
    teamwork_done = bool(teamwork.get("dimension_scores"))

    return (15 if behavior_done else 0) + (15 if teamwork_done else 0)


def _skill_names(profile_data: Dict) -> List[str]:
    """Skill names from the Phase 1 ability.skills[] contract (list shape only)."""
    skills = (profile_data.get("ability") or {}).get("skills") or []
    if not isinstance(skills, list):
        return []
    return [
        str(s.get("name"))
        for s in skills
        if isinstance(s, dict) and s.get("name")
    ]


def _team_skill_set(db: Session, team: Team) -> Set[str]:
    """Normalized union of skills across the team's members' candidate profiles."""
    member_ids = [m.user_id for m in team.members]
    if not member_ids:
        return set()

    profiles = (
        db.query(CandidateProfile)
        .filter(CandidateProfile.user_id.in_(member_ids))
        .all()
    )
    skills: Set[str] = set()
    for profile in profiles:
        skills.update(
            _normalize(name) for name in _skill_names(profile.profile_data or {})
        )
    return skills


def _build_bio(profile: Profile, data: Dict) -> str:
    """Synthesize a short bio mirroring the /candidates route."""
    role = (data.get("role") or {}).get("role") or ""
    experience = (data.get("experience") or {}).get("level") or ""
    skills = _skill_names(data)

    parts = []
    if role:
        parts.append(role.replace("_", " ").title())
    if experience:
        parts.append(f"{experience.title()} level")
    if skills:
        parts.append("skilled in " + ", ".join(skills[:4]))
    if profile.college:
        parts.append("from " + profile.college)

    if parts:
        return f"{profile.name} — {' '.join(parts)}."
    return f"{profile.name}'s profile."


def recommend_members(
    db: Session,
    team_id: uuid.UUID,
    requester: User,
    limit: int = 20,
) -> List[MemberRecommendation]:
    """Rank discoverable candidates for a team (requester must be a member)."""
    team = get_team_by_id(db, team_id)
    if team is None:
        raise TeamNotFoundError("Team not found")

    membership = (
        db.query(TeamMember)
        .filter(
            TeamMember.team_id == team_id,
            TeamMember.user_id == requester.id,
        )
        .first()
    )
    if membership is None:
        raise NotTeamMemberError(
            "You must be a member of this team to discover candidates"
        )

    team_member_ids = {m.user_id for m in team.members}

    full_team_user_ids = set(
        db.query(TeamMember.user_id)
        .join(Team, Team.id == TeamMember.team_id)
        .filter(Team.status == TeamStatus.FULL)
        .scalars()
        .all()
    )

    pending_receiver_ids = set(
        db.query(TeamInvitation.receiver_id)
        .filter(
            TeamInvitation.team_id == team_id,
            TeamInvitation.status == InvitationStatus.PENDING,
        )
        .scalars()
        .all()
    )

    excluded_ids = team_member_ids | full_team_user_ids | pending_receiver_ids

    query = (
        db.query(CandidateProfile, Profile, User)
        .join(Profile, Profile.user_id == CandidateProfile.user_id)
        .join(User, User.id == CandidateProfile.user_id)
        .filter(CandidateProfile.profile_data["ability"].has_key("skills"))
        .order_by(CandidateProfile.profile_strength.desc())
    )
    if excluded_ids:
        query = query.filter(~User.id.in_(excluded_ids))

    rows = query.all()

    team_domains = list(team.domains or [])
    team_skills = _team_skill_set(db, team)

    recommendations: List[MemberRecommendation] = []
    for candidate, profile, user in rows:
        data = candidate.profile_data or {}
        role = (data.get("role") or {}).get("role") or "unknown"

        domain_match = _match_domains(team_domains, ROLE_DOMAINS.get(role, set()))
        domain_score = DOMAIN_WEIGHT if domain_match else 0

        assessment_score = _assessment_compatibility(data)

        candidate_skills = _skill_names(data)
        candidate_skill_set = {_normalize(s) for s in candidate_skills}
        skill_overlap = [
            s for s in candidate_skills if _normalize(s) in team_skills
        ]
        if team_skills:
            skill_score = round(
                SKILL_WEIGHT * len(skill_overlap) / len(team_skills)
            )
        else:
            skill_score = SKILL_WEIGHT // 2  # neutral until the team has skills

        total = domain_score + assessment_score + skill_score

        recommendations.append(
            MemberRecommendation(
                user_id=user.id,
                name=profile.name,
                avatar_url=profile.avatar_url,
                college=profile.college,
                city=profile.city,
                github_url=profile.github_url,
                bio=_build_bio(profile, data),
                role=role,
                skills=candidate_skills,
                experience_level=(data.get("experience") or {}).get("level")
                or "unknown",
                commitment_level=(data.get("availability") or {}).get(
                    "commitment_level"
                )
                or "",
                profile_strength=candidate.profile_strength or 0,
                compatibility_score=total,
                domain_match=domain_match,
                assessment_compatibility=assessment_score,
                skill_overlap=skill_overlap,
            )
        )

    recommendations.sort(
        key=lambda r: r.compatibility_score, reverse=True
    )
    return recommendations[:limit]
