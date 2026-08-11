import { assetUrl } from '../api';

const initials = (name?: string | null) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0]?.[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] || '' : '';
  return (first + last).toUpperCase();
};

interface AvatarProps {
  name?: string | null;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}

const Avatar = ({ name, avatarUrl, size = 36, className = '' }: AvatarProps) => {
  const src = assetUrl(avatarUrl);

  if (src) {
    return (
      <img
        src={src}
        alt={name || 'Profile'}
        className={`avatar-img ${className}`}
        width={size}
        height={size}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className={`avatar-fallback ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
};

export default Avatar;
