import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signUp } from 'aws-amplify/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Mail, Lock } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordHints } from '@/components/auth/PasswordHints';
import { authErrorMessage } from '@/lib/authErrors';
import {
  emailField,
  fieldErrors,
  passwordField,
  registerSchema,
} from '@/lib/validation';
import { fadeInUp } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { Gender } from '@/lib/avatar';

const ROLES = [
  { value: 'soc-analyst', label: 'SOC Analyst' },
  { value: 'security-operator', label: 'Security Operator' },
  { value: 'security-analyst', label: 'Security Analyst' },
] as const;

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

export default function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<string>('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(false);

  function clearError(field: string) {
    if (errors[field]) setErrors((p) => ({ ...p, [field]: '' }));
  }

  function onEmailChange(value: string) {
    setEmail(value);
    if (value.length > 0) setRevealed(true);
    clearError('email');
  }

  function validateOnBlur(field: 'email' | 'password') {
    const schema = field === 'email' ? emailField : passwordField;
    const value = field === 'email' ? email : password;
    const r = schema.safeParse(value);
    setErrors((p) => ({
      ...p,
      [field]: r.success ? '' : (r.error.issues[0]?.message ?? ''),
    }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found = fieldErrors(registerSchema, { email, password, role, gender });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setError(null);
    setBusy(true);
    try {
      const result = await signUp({
        username: email.trim(),
        password,
        options: {
          userAttributes: {
            email: email.trim(),
            'custom:role': role,
            'custom:gender': gender,
          },
        },
      });
      if (result.nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
        navigate('/verify', { state: { email: email.trim() } });
      } else {
        navigate('/login');
      }
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Request access to the analyst console."
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              onBlur={() => validateOnBlur('email')}
              aria-invalid={Boolean(errors.email)}
              className="pl-9"
            />
          </div>
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>

        <AnimatePresence initial={false}>
          {revealed && (
            <motion.div
              key="rest"
              variants={fadeInUp}
              initial="hidden"
              animate="show"
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearError('password');
                    }}
                    onBlur={() => validateOnBlur('password')}
                    aria-invalid={Boolean(errors.password)}
                    className="pl-9"
                  />
                </div>
                <PasswordHints password={password} />
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="role">Role</Label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value);
                    clearError('role');
                  }}
                  aria-invalid={Boolean(errors.role)}
                  className="flex h-9 w-full rounded-md border border-input bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="" disabled>
                    Select a role…
                  </option>
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                {errors.role && <p className="text-xs text-destructive">{errors.role}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Gender</Label>
                <div
                  className="grid grid-cols-3 gap-2"
                  role="radiogroup"
                  aria-label="Gender"
                >
                  {GENDERS.map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      role="radio"
                      aria-checked={gender === g.value}
                      onClick={() => {
                        setGender(g.value);
                        clearError('gender');
                      }}
                      className={cn(
                        'h-9 rounded-md border text-sm transition-colors',
                        gender === g.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-input text-muted-foreground hover:bg-surface-2',
                      )}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Used only to generate your default avatar — you can upload your own later.
                </p>
                {errors.gender && (
                  <p className="text-xs text-destructive">{errors.gender}</p>
                )}
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="animate-spin" />} Create account
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
