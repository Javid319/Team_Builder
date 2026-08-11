export type SkillBadgeType = 'learner' | 'assessed' | 'verified' | 'verified_assessed';

export const SKILL_BADGE_META: Record<SkillBadgeType, { label: string; icon: string; className: string; stars: number }> = {
  learner:           { label: 'Learner',                icon: '📘', className: 'badge-skill-learner', stars: 1 },
  assessed:          { label: 'Assessed',               icon: '🟢', className: 'badge-skill-assessed', stars: 2 },
  verified:          { label: 'Verified',               icon: '🔵', className: 'badge-skill-verified', stars: 3 },
  verified_assessed: { label: 'Verified + Assessed',    icon: '🟣', className: 'badge-skill-verified-assessed', stars: 4 },
};

export const GH_VERIFIED_KEY = 'hackcomp_github_verified_skills';

export const normalizeSkill = (name: string) => String(name || '').trim().toLowerCase();

export const namesToSet = (names: string[] = []): Set<string> =>
  new Set(names.map(normalizeSkill).filter(Boolean));

export const passedSkillNames = (results: { name?: string; confidence_level?: string }[] = []): Set<string> =>
  namesToSet(
    results
      .filter((s) => {
        const l = String(s.confidence_level || '').toLowerCase();
        return l === 'high' || l === 'medium';
      })
      .map((s) => s.name)
      .filter((n): n is string => Boolean(n))
  );

export const loadVerifiedSkills = (): Set<string> => {
  try {
    const raw = localStorage.getItem(GH_VERIFIED_KEY);
    if (!raw) return new Set();
    return namesToSet(JSON.parse(raw));
  } catch {
    return new Set();
  }
};

export const saveVerifiedSkills = (names: string[]) => {
  try {
    const normalized = [...new Set(names.map(normalizeSkill).filter(Boolean))];
    localStorage.setItem(GH_VERIFIED_KEY, JSON.stringify(normalized));
  } catch {
    // Storage unavailable — badges fall back to Learner
  }
};

export const getSkillBadge = (
  name: string,
  assessedNames: Set<string>,
  verifiedNames: Set<string>,
): SkillBadgeType => {
  const n = normalizeSkill(name);
  const assessed = assessedNames.has(n);
  const verified = verifiedNames.has(n);
  if (assessed && verified) return 'verified_assessed';
  if (assessed) return 'assessed';
  if (verified) return 'verified';
  return 'learner';
};
