import { z } from 'zod';

// Manual email regex (version-proof across zod majors) — same intent as z.email.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const emailField = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .regex(EMAIL_RE, 'Enter a valid email address');

// Mirrors the Cognito password policy (infra/modules/cognito password_policy).
export const passwordField = z
  .string()
  .min(12, 'At least 12 characters')
  .regex(/[A-Z]/, 'Add an uppercase letter')
  .regex(/[a-z]/, 'Add a lowercase letter')
  .regex(/\d/, 'Add a number')
  .regex(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/, 'Add a symbol');

const ROLE_VALUES = ['soc-analyst', 'security-operator', 'security-analyst'] as const;
const GENDER_VALUES = ['male', 'female', 'other'] as const;

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  email: emailField,
  password: passwordField,
  role: z
    .string()
    .refine((v) => (ROLE_VALUES as readonly string[]).includes(v), 'Select a role'),
  gender: z
    .string()
    .refine((v) => (GENDER_VALUES as readonly string[]).includes(v), 'Select a gender'),
});

/**
 * Run a schema and collapse zod issues into a `{ field: message }` map (first
 * message per field). Empty object means valid.
 */
export function fieldErrors(
  schema: z.ZodType,
  data: unknown,
): Record<string, string> {
  const result = schema.safeParse(data);
  if (result.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}
