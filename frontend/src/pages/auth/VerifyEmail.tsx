import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { confirmSignUp, resendSignUpCode } from 'aws-amplify/auth';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OtpInput } from '@/components/auth/OtpInput';
import { authErrorMessage } from '@/lib/authErrors';

interface LocationState {
  email?: string;
}

export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialEmail = (location.state as LocationState | null)?.email ?? '';

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await confirmSignUp({ username: email, confirmationCode: code });
      toast.success('Email verified — you can sign in now.');
      navigate('/login', { state: { email } });
    } catch (err) {
      setError(authErrorMessage(err));
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    try {
      await resendSignUpCode({ username: email });
      toast.success('A new code is on its way.');
    } catch (err) {
      setError(authErrorMessage(err));
    }
  }

  return (
    <AuthLayout
      title="Verify your email"
      subtitle="Enter the 6-digit code we sent to confirm your account."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {!initialEmail && (
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Verification code</Label>
          <OtpInput value={code} onChange={setCode} aria-label="Email verification code" />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          type="submit"
          className="w-full"
          disabled={busy || code.length < 6 || !email}
        >
          {busy && <Loader2 className="animate-spin" />} Verify email
        </Button>
        <button
          type="button"
          onClick={resend}
          disabled={!email}
          className="w-full text-center text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          Resend code
        </button>
      </form>
    </AuthLayout>
  );
}
