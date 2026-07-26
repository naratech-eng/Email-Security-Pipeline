import { useRef, useState } from 'react';
import { updateUserAttributes } from 'aws-amplify/auth';
import { Loader2, Upload, Sun, Moon } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { UserAvatar } from '@/components/user/UserAvatar';
import { useAuth } from '@/auth/AuthProvider';
import { useTheme } from '@/hooks/useTheme';
import { avatarUploadEnabled } from '@/lib/amplify';
import { uploadAvatar, validateAvatarFile } from '@/lib/avatarStorage';
import { isGender, type Gender } from '@/lib/avatar';
import { authErrorMessage } from '@/lib/authErrors';
import { cn } from '@/lib/utils';

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user, refresh } = useAuth();
  const { theme, setTheme } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const uploadOn = avatarUploadEnabled();

  async function onFile(file: File) {
    const invalid = validateAvatarFile(file);
    if (invalid) {
      toast.error(invalid.message);
      return;
    }
    if (!user?.sub) return;
    setBusy(true);
    try {
      await uploadAvatar(file, user.sub);
      await refresh({ force: true });
      toast.success('Profile photo updated.');
    } catch (err) {
      toast.error(authErrorMessage(err, 'Upload failed. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  async function setGender(gender: Gender) {
    if (gender === user?.gender) return;
    setBusy(true);
    try {
      await updateUserAttributes({ userAttributes: { 'custom:gender': gender } });
      await refresh({ force: true });
      toast.success('Avatar updated.');
    } catch (err) {
      toast.error(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Your profile and appearance.</DialogDescription>
        </DialogHeader>

        {/* Profile photo */}
        <section className="space-y-3">
          <Label>Profile photo</Label>
          <div className="flex items-center gap-4">
            <UserAvatar user={user} className="size-16" />
            <div className="space-y-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || !uploadOn}
                onClick={() => fileRef.current?.click()}
              >
                {busy ? <Loader2 className="animate-spin" /> : <Upload />} Upload image
              </Button>
              <p className="text-xs text-muted-foreground">
                {uploadOn
                  ? 'PNG, JPG, or WebP — max 2 MB.'
                  : 'Uploads aren’t enabled in this environment; a generated avatar is used.'}
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
                e.target.value = '';
              }}
            />
          </div>
        </section>

        {/* Generated-avatar gender */}
        <section className="space-y-2">
          <Label>Generated avatar style</Label>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Avatar gender">
            {GENDERS.map((g) => (
              <button
                key={g.value}
                type="button"
                role="radio"
                aria-checked={isGender(user?.gender) && user?.gender === g.value}
                disabled={busy}
                onClick={() => void setGender(g.value)}
                className={cn(
                  'h-9 rounded-md border text-sm transition-colors disabled:opacity-50',
                  user?.gender === g.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-input text-muted-foreground hover:bg-surface-2',
                )}
              >
                {g.label}
              </button>
            ))}
          </div>
        </section>

        {/* Theme */}
        <section className="space-y-2">
          <Label>Theme</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={cn(
                'flex h-9 items-center justify-center gap-2 rounded-md border text-sm transition-colors',
                theme === 'dark'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-input text-muted-foreground hover:bg-surface-2',
              )}
            >
              <Moon className="size-4" /> Dark
            </button>
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={cn(
                'flex h-9 items-center justify-center gap-2 rounded-md border text-sm transition-colors',
                theme === 'light'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-input text-muted-foreground hover:bg-surface-2',
              )}
            >
              <Sun className="size-4" /> Light
            </button>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
