import { uploadData, getUrl } from 'aws-amplify/storage';
import { updateUserAttributes } from 'aws-amplify/auth';
import { avatarUploadEnabled } from '@/lib/amplify';

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB

export interface AvatarValidationError {
  message: string;
}

export function validateAvatarFile(file: File): AvatarValidationError | null {
  if (!file.type.startsWith('image/')) {
    return { message: 'Choose an image file (PNG, JPG, or WebP).' };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { message: 'Image is too large (max 2 MB).' };
  }
  return null;
}

/**
 * Upload a profile image to the user's own S3 prefix (via the Cognito Identity
 * Pool) and record the storage key on the Cognito profile (custom:avatar_url).
 * Requires the identity pool + bucket to be configured (avatarUploadEnabled()).
 */
export async function uploadAvatar(file: File, sub: string): Promise<string> {
  if (!avatarUploadEnabled()) {
    throw new Error('Avatar upload is not configured for this environment.');
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const key = `avatars/${sub}/avatar.${ext}`;

  await uploadData({
    path: ({ identityId }) => `private/${identityId}/${key}`,
    data: file,
    options: { contentType: file.type },
  }).result;

  // Persist the logical key; resolveAvatarSrc turns it into a signed URL.
  await updateUserAttributes({ userAttributes: { 'custom:avatar_url': key } });
  return key;
}

/**
 * Resolve a stored avatar reference to a displayable src. Full URLs pass
 * through; storage keys are signed via getUrl. Returns null on any failure so
 * the caller falls back to the generated avatar.
 */
export async function resolveAvatarSrc(
  avatarUrl: string | undefined,
): Promise<string | null> {
  if (!avatarUrl) return null;
  if (/^https?:\/\//.test(avatarUrl)) return avatarUrl;
  if (!avatarUploadEnabled()) return null;
  try {
    const { url } = await getUrl({
      path: ({ identityId }) => `private/${identityId}/${avatarUrl}`,
    });
    return url.toString();
  } catch {
    return null;
  }
}
