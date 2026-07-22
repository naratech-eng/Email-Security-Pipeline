import { useState } from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

type Detection = {
  id: string;
  source: 'upload' | 'server' | 'preview';
  sender: string;
  subject: string;
  verdict: string;
  score: number;
};

const sampleDetections: Detection[] = [
  { id: '1', source: 'upload', sender: 'attacker@example.com', subject: 'Urgent password reset', verdict: 'phishing', score: 0.91 },
  { id: '2', source: 'server', sender: 'accounting@vendor.com', subject: 'Invoice attached', verdict: 'benign', score: 0.12 },
];

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'https://esp-api.naratech.xyz';
const siteName = import.meta.env.VITE_SITE_NAME ?? 'SecureInbox';

function Dashboard() {
  const [email, setEmail] = useState('');
  const [detections, setDetections] = useState<Detection[]>(sampleDetections);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const submitEmail = async () => {
    if (!email.trim()) {
      setApiError('Paste a raw email before submitting.');
      return;
    }

    setLoading(true);
    setApiError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/score`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw_email: email }),
      });

      if (!response.ok) {
        throw new Error(`API error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const newDetection: Detection = {
        id: Date.now().toString(),
        source: 'upload',
        sender: data.sender ?? 'Uploaded email',
        subject: data.subject ?? 'Uploaded email',
        verdict: data.verdict ?? 'unknown',
        score: typeof data.score === 'number' ? data.score : 0,
      };

      setDetections((current) => [newDetection, ...current]);
      setEmail('');
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Unknown API error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-cyan-400">{siteName} operator dashboard</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white">Secure email verdicts from {siteName}</h1>
            <p className="mt-2 max-w-xl text-slate-300">
              Paste a suspicious email and get an immediate verdict from the inference API. Hosted at <span className="font-semibold text-white">secureinbox.skywork.website</span>.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <section className="grid gap-8 xl:grid-cols-[1.7fr_1fr]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl shadow-slate-950/30">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-cyan-400">Upload tool</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Paste raw email source</h2>
              </div>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-300">API: {apiBaseUrl}/score</span>
            </div>

            <textarea
              className="h-72 w-full resize-none rounded-3xl border border-slate-800 bg-slate-950 px-4 py-4 text-sm leading-6 text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
              placeholder="Paste raw email source here..."
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            {apiError ? <p className="mt-3 text-sm text-rose-400">{apiError}</p> : null}

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                className="inline-flex items-center justify-center rounded-3xl bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onClick={submitEmail}
                disabled={loading}
              >
                {loading ? 'Submitting…' : 'Submit for verdict'}
              </button>
              <p className="text-sm text-slate-400">This app uses the `VITE_API_BASE_URL` environment variable for Amplify and local builds.</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl shadow-slate-950/20">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-cyan-400">Known verdicts</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Latest detections</h2>
                </div>
                <button className="rounded-full border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:border-cyan-400 hover:text-white" type="button">
                  Refresh
                </button>
              </div>

              <div className="mt-6 space-y-4">
                {detections.map((item) => (
                  <div key={item.id} className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm uppercase tracking-[0.24em] text-slate-500">{item.source}</p>
                        <p className="text-lg font-semibold text-white">{item.subject}</p>
                        <p className="text-sm text-slate-400">From: {item.sender}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="rounded-2xl bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-400">
                          {item.verdict}
                        </span>
                        <span className="text-sm font-semibold text-white">Score: {item.score}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl shadow-slate-950/20">
              <h3 className="text-xl font-semibold text-white">API integration notes</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-300">
                <li>• The dashboard calls the inference API at <code className="rounded bg-slate-950 px-2 py-1 text-xs text-slate-200">{apiBaseUrl}/score</code>.</li>
                <li>• In Amplify, set `VITE_API_BASE_URL` to your inference API host.</li>
                <li>• Enable pull request previews in Amplify for `secureinbox.skywork.website` PR branches.</li>
              </ul>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function App() {
  return (
    <Authenticator hideSignUp loginMechanisms={['username']}>
      {({ signOut, user }) => (
        <>
          <div className="flex items-center justify-between bg-slate-900 border-b border-slate-700 px-6 py-4">
            <div>
              <h2 className="text-white font-semibold text-lg">
                SecureInbox Dashboard
              </h2>

              <p className="text-slate-300 text-sm">
                Signed in as {user?.username}
              </p>
            </div>

            <button
              onClick={signOut}
              className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              Sign Out
            </button>
          </div>

          <Dashboard />
        </>
      )}
    </Authenticator>
  );
}

export default App;
