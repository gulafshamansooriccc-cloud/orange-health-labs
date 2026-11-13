import { useState } from 'react';
import { ImageOff } from 'lucide-react';

interface ResilientImageProps {
  src: string;
  alt: string;
  className?: string;
}

export function ResilientImage({ src, alt, className = '' }: ResilientImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 px-6 py-10 text-center ${className}`}
      >
        <ImageOff className="w-5 h-5 opacity-60" strokeWidth={1.5} />
        <span className="text-xs font-medium tracking-tight">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

interface MemberAvatarProps {
  name: string;
  avatarUrl?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-lg',
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function MemberAvatar({ name, avatarUrl, size = 'md' }: MemberAvatarProps) {
  const [failed, setFailed] = useState(false);
  const sizeClass = SIZE_MAP[size];

  if (!avatarUrl || failed) {
    return (
      <div
        aria-label={name}
        className={`${sizeClass} shrink-0 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-display font-semibold flex items-center justify-center select-none border border-neutral-300/70 dark:border-neutral-700/70`}
      >
        {getInitials(name)}
      </div>
    );
  }

  return (
    <img
      src={avatarUrl}
      alt={name}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${sizeClass} shrink-0 rounded-full object-cover border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900`}
    />
  );
}
