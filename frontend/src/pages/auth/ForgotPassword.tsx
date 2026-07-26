import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { resetPassword, confirmResetPassword } from 'aws-amplify/auth';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OtpInput } from '@/components/auth/OtpInput';
import { PasswordHints, passwordValid } from '@/components/auth/PasswordHints';
import { authErrorMessage } from '@/lib/authErrors';

interface LocationState {
  email?: string;
}

type Step = 'request' | 'confirm';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(
    (location.state as LocationState | null)?.email ?? '',
  );
  const [step, setStep] = useState<Step>('request');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onRequest(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await resetPassword({ username: email });
      toast.success('Check your email for a reset code.');
      setStep('confirm');
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onConfirm(e: FormEvent) {
    e.preventDefault();
    if (!passwordValid(password)) return;
    setError(null);
    setBusy(true);
    try {
      await confirmResetPassword({
        username: email,
        confirmationCode: code,
        newPassword: password,
      });
      toast.success('Password reset — sign in with your new password.');
      navigate('/login', { state: { email } });
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (step === 'confirm') {
    return (
      <AuthLayout
        title="Reset your password"
        subtitle={`Enter the code sent to ${email} and choose a new password.`}
      >
        <form onSubmit={onConfirm} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Reset code</Label>
            <OtpInput value={code} onChange={setCode} aria-label="Password reset code" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <PasswordHints password={password} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="submit"
            className="w-full"
            disabled={busy || code.length < 6 || !passwordValid(password)}
          >
            {busy && <Loader2 className="animate-spin" />} Reset password
          </Button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Forgot password"
      subtitle="We’ll email you a code to reset it."
    >
      <form onSubmit={onRequest} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy || !email}>
          {busy && <Loader2 className="animate-spin" />} Send reset code
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          <Link to="/login" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
