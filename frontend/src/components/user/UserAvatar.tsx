import { useEffect, useMemo, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { generatedAvatar } from '@/lib/avatar';
import { resolveAvatarSrc } from '@/lib/avatarStorage';
import type { AuthUser } from '@/auth/AuthProvider';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  user: Pick<AuthUser, 'email' | 'gender' | 'avatarUrl'> | null;
  className?: string;
}

/**
 * Profile avatar: shows the user's uploaded image when available, otherwise a
 * deterministic gender-tinted generated avatar. Never blank.
 */
export function UserAvatar({ user, className }: UserAvatarProps) {
  const generated = useMemo(
    () => generatedAvatar(user?.email ?? '', user?.gender),
    [user?.email, user?.gender],
  );
  const [uploaded, setUploaded] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    resolveAvatarSrc(user?.avatarUrl).then((src) => {
      if (active) setUploaded(src);
    });
    return () => {
      active = false;
    };
  }, [user?.avatarUrl]);

  return (
    <Avatar className={cn(className)}>
      <AvatarImage src={uploaded ?? generated} alt="" />
      <AvatarFallback>
        <img src={generated} alt="" className="size-full" />
      </AvatarFallback>
    </Avatar>
  );
}
