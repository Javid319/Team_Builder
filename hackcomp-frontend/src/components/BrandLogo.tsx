import { Terminal } from 'lucide-react';

interface BrandLogoProps {
  size?: number;
  showWordmark?: boolean;
}

const BrandLogo = ({ size = 24, showWordmark = true }: BrandLogoProps) => {
  const iconSize = Math.round(size * 0.5);
  return (
    <div className="brand">
      <span className="brand-mark" style={{ width: size, height: size }}>
        <Terminal size={iconSize} strokeWidth={2.4} />
      </span>
      {showWordmark && <span className="brand-text">HackComp</span>}
    </div>
  );
};

export default BrandLogo;
