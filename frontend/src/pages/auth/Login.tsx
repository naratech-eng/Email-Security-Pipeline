import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { signIn, confirmSignIn } from 'aws-amplify/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Mail, Lock } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OtpInput } from '@/components/auth/OtpInput';
import { useAuth } from '@/auth/AuthProvider';
import { authErrorMessage } from '@/lib/authErrors';
import { emailField, fieldErrors, loginSchema } from '@/lib/validation';
import { fadeInUp } from '@/lib/motion';

type Step = 'password' | 'mfa';

interface LocationState {
  from?: { pathname: string };
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refresh } = useAuth();
  const from = (location.state as LocationState | null)?.from?.pathname ?? '/';

  const [step, setStep] = useState<Step>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [maskedDest, setMaskedDest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  // Progressive disclosure: password appears once the user starts on email.
  const [revealed, setRevealed] = useState(false);

  async function finish() {
    await refresh({ force: true });
    navigate(from, { replace: true });
  }

  async function onPasswordSubmit(e: FormEvent) {
    e.preventDefault();
    const found = fieldErrors(loginSchema, { email, password });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setError(null);
    setBusy(true);
    try {
      const { nextStep } = await signIn({ username: email.trim(), password });
      switch (nextStep.signInStep) {
        case 'DONE':
          await finish();
          break;
        case 'CONFIRM_SIGN_IN_WITH_EMAIL_CODE':
          setMaskedDest(nextStep.codeDeliveryDetails?.destination ?? null);
          setStep('mfa');
          break;
        case 'CONFIRM_SIGN_UP':
          navigate('/verify', { state: { email } });
          break;
        case 'RESET_PASSWORD':
          navigate('/forgot-password', { state: { email } });
          break;
        default:
          setError('This account needs additional setup to sign in.');
      }
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onMfaSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await confirmSignIn({ challengeResponse: code });
      if (result.nextStep.signInStep === 'DONE') {
        await finish();
      } else {
        setError('Additional verification is required.');
      }
    } catch (err) {
      setError(authErrorMessage(err));
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  function onEmailChange(value: string) {
    setEmail(value);
    if (value.length > 0) setRevealed(true);
    if (errors.email) setErrors((p) => ({ ...p, email: '' }));
  }

  function validateEmailField() {
    const r = emailField.safeParse(email);
    setErrors((p) => ({
      ...p,
      email: r.success ? '' : (r.error.issues[0]?.message ?? ''),
    }));
  }

  function restart() {
    setStep('password');
    setCode('');
    setError(null);
  }

  if (step === 'mfa') {
    return (
      <AuthLayout
        title="Enter your code"
        subtitle={
          maskedDest
            ? `We sent a 6-digit code to ${maskedDest}.`
            : 'We sent a 6-digit code to your email.'
        }
      >
        <form onSubmit={onMfaSubmit} className="space-y-4">
          <OtpInput value={code} onChange={setCode} aria-label="Email verification code" />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy || code.length < 6}>
            {busy && <Loader2 className="animate-spin" />} Verify &amp; sign in
          </Button>
          <button
            type="button"
            onClick={restart}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            Didn&rsquo;t get a code? Start over
          </button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Sign in" subtitle="Access the Email Security Pipeline console.">
      <form onSubmit={onPasswordSubmit} className="space-y-4" noValidate>
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
              onBlur={validateEmailField}
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors((p) => ({ ...p, password: '' }));
                    }}
                    aria-invalid={Boolean(errors.password)}
                    className="pl-9"
                  />
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password}</p>
                )}
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="animate-spin" />} Sign in
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-center text-sm text-muted-foreground">
          No account?{' '}
          <Link to="/register" className="text-primary hover:underline">
            Create one
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
