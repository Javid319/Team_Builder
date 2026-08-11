import { SKILL_BADGE_META, type SkillBadgeType } from '../utils/skillBadges';
import { Star } from 'lucide-react';

const SkillBadge = ({ badge, title }: { badge: SkillBadgeType; title?: string }) => {
  const meta = SKILL_BADGE_META[badge];
  return (
    <span className={`badge-skill ${meta.className}`} title={title || meta.label}>
      <span className="skill-badge-stars" aria-label={`${meta.stars} star${meta.stars === 1 ? '' : 's'}`}>
        {Array.from({ length: meta.stars }).map((_, i) => (
          <Star key={i} size={9} className="skill-badge-star" />
        ))}
      </span>
    </span>
  );
};

export default SkillBadge;
