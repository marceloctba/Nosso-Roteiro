import React from 'react';

interface MinimalGeometricCoverProps {
  className?: string;
}

export const MinimalGeometricCover: React.FC<MinimalGeometricCoverProps> = ({
  className = 'w-full h-full',
}) => {
  return (
    <svg
      viewBox="0 0 800 320"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
    >
      <rect width="800" height="320" fill="#F1F5F9" />
      <circle cx="670" cy="70" r="140" fill="#E2E8F0" />
      <circle cx="670" cy="70" r="88" fill="#F8FAFC" />
      <rect x="460" y="170" width="220" height="220" rx="28" fill="#E2E8F0" opacity="0.7" />
      <path d="M510 320L630 165L750 320H510Z" fill="#CBD5E1" opacity="0.65" />
      <circle cx="140" cy="60" r="56" fill="#E2E8F0" opacity="0.6" />
      <line x1="0" y1="240" x2="800" y2="240" stroke="#CBD5E1" strokeWidth="1" opacity="0.55" />
      <line x1="560" y1="0" x2="560" y2="320" stroke="#CBD5E1" strokeWidth="1" opacity="0.45" />
    </svg>
  );
};
