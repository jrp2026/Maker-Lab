import { useEffect, useRef, useState } from 'react';
import { HCAPTCHA_SITE_KEY } from '../cloud/config';
import {
  accountError, closeAccountDialog, completeCaptcha, resetPassword, signInEmail, signInGoogle, signOutAccount, signUpEmail, useAccount,
} from '../cloud/account';

// ------------------------------------------------------------------ hCaptcha

declare global {
  interface Window {
    hcaptcha?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
  }
}

let hcaptchaScript: Promise<void> | null = null;
function loadHcaptcha(): Promise<void> {
  if (window.hcaptcha) return Promise.resolve();
  if (!hcaptchaScript) {
    hcaptchaScript = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://js.hcaptcha.com/1/api.js?render=explicit&recaptchacompat=off';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        hcaptchaScript = null;
        reject(new Error('Could not load hCaptcha — check your connection or ad blocker.'));
      };
      document.head.appendChild(s);
    });
  }
  return hcaptchaScript;
}

/** The hCaptcha checkbox. `onToken` gets the response token ('' when it expires). */
function HCaptcha({ onToken, resetKey }: { onToken: (t: string) => void; resetKey: number }) {
  const host = useRef<HTMLDivElement>(null);
  const cb = useRef(onToken);
  cb.current = onToken;
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let id: string | null = null;
    let alive = true;
    loadHcaptcha()
      .then(() => {
        if (!alive || !host.current || !window.hcaptcha) return;
        id = window.hcaptcha.render(host.current, {
          sitekey: HCAPTCHA_SITE_KEY,
          callback: (t: string) => cb.current(t),
          'expired-callback': () => cb.current(''),
          'error-callback': () => cb.current(''),
        });
      })
      .catch((e) => setErr((e as Error).message));
    return () => {
      alive = false;
      if (id !== null) window.hcaptcha?.remove(id);
    };
  }, [resetKey]);
  if (!HCAPTCHA_SITE_KEY) return <div className="insp-warn error">hCaptcha isn't configured in this build (VITE_HCAPTCHA_SITE_KEY).</div>;
  return (
    <div className="captcha-box">
      <div ref={host} />
      {err && <div className="insp-warn error">{err}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ dialog

const GoogleIcon = () => (
  <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden>
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

export function AccountDialog() {
  const dialog = useAccount((s) => s.dialog);
  const user = useAccount((s) => s.user);
  const verified = useAccount((s) => s.verified);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // close once signed in and verified
  useEffect(() => {
    if (dialog && user && verified) closeAccountDialog();
  }, [dialog, user, verified]);
  useEffect(() => {
    setError(null);
    setInfo(null);
    setToken('');
  }, [dialog]);
  if (!dialog) return null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await fn();
    } catch (e) {
      setError(accountError(e));
      // a captcha token works once: get a fresh one after a failed attempt
      setToken('');
      setResetKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  };
  const tab = (d: 'signin' | 'signup') => useAccount.setState({ dialog: d });

  if (dialog === 'captcha') {
    return (
      <div className="modal-back">
        <div className="modal account-modal" role="dialog" aria-label="Confirm you are human">
          <h3>One more step</h3>
          <p className="muted">Confirm you're a person to finish setting up {user?.email ? <b>{user.email}</b> : 'your account'}. Then your projects can be saved in the cloud.</p>
          <HCaptcha onToken={setToken} resetKey={resetKey} />
          {error && <div className="insp-warn error">{error}</div>}
          <div className="row gap end">
            <button className="link" disabled={busy} onClick={() => run(async () => { await signOutAccount(); closeAccountDialog(); })}>Sign out</button>
            <button className="btn primary" disabled={!token || busy} onClick={() => run(() => completeCaptcha(token))}>{busy ? 'Checking…' : 'Continue'}</button>
          </div>
        </div>
      </div>
    );
  }

  const signup = dialog === 'signup';
  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && !busy && closeAccountDialog()}>
      <div className="modal account-modal" role="dialog" aria-label={signup ? 'Create an account' : 'Sign in'}>
        <div className="modal-head">
          <div>
            <h3>{signup ? 'Create your MakerLab account' : 'Sign in to MakerLab'}</h3>
            <p className="muted small">Your projects are saved in the cloud and sync between your devices.</p>
          </div>
          <button className="icon-btn" aria-label="Close" onClick={closeAccountDialog}>✕</button>
        </div>
        <div className="mode-tabs account-tabs" role="tablist">
          <button className={!signup ? 'on' : ''} onClick={() => tab('signin')}>Sign in</button>
          <button className={signup ? 'on' : ''} onClick={() => tab('signup')}>Create account</button>
        </div>
        <button className="btn google-btn" disabled={busy || (signup && !token)} onClick={() => run(() => signInGoogle(signup ? token : undefined))} title={signup && !token ? 'Solve the captcha first' : undefined}>
          <GoogleIcon /> Continue with Google
        </button>
        <div className="or-line"><span>or with email</span></div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => (signup ? signUpEmail(email.trim(), password, token) : signInEmail(email.trim(), password)));
          }}
        >
          <label>Email<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>Password<input type="password" autoComplete={signup ? 'new-password' : 'current-password'} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          {signup && <HCaptcha onToken={setToken} resetKey={resetKey} />}
          {error && <div className="insp-warn error">{error}</div>}
          {info && <div className="insp-warn">{info}</div>}
          <button className="btn primary block" type="submit" disabled={busy || (signup && !token)}>
            {busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}
          </button>
        </form>
        {!signup && (
          <button className="link small" disabled={busy} onClick={() => {
            if (!email.trim()) return setError('Type your email above first.');
            run(async () => {
              await resetPassword(email.trim());
              setInfo('Check your inbox for a link to choose a new password.');
            });
          }}>Forgot your password?</button>
        )}
        <p className="muted small">Signing up needs the captcha (it stops robots from making accounts). Your projects stay in this browser too.</p>
      </div>
    </div>
  );
}

/** Small account chip: "Sign in" or the signed-in user with a menu. */
export function AccountChip() {
  const status = useAccount((s) => s.status);
  const user = useAccount((s) => s.user);
  const [menu, setMenu] = useState(false);
  if (status === 'off') return null;
  if (status !== 'signed-in' || !user) {
    return (
      <button className="btn" onClick={() => useAccount.setState({ dialog: 'signin' })} disabled={status === 'loading'}>
        {status === 'loading' ? 'Connecting…' : '☁ Sign in to sync'}
      </button>
    );
  }
  const initial = (user.name ?? user.email ?? '?').trim()[0]?.toUpperCase() ?? '?';
  return (
    <div className="menu account-chip">
      <button className="btn" onClick={() => setMenu(!menu)} title={user.email ?? undefined}>
        {user.photo ? <img src={user.photo} alt="" className="avatar" referrerPolicy="no-referrer" /> : <span className="avatar">{initial}</span>}
        <span className="account-name">{user.name ?? user.email}</span>
      </button>
      {menu && (
        <div className="menu-pop" onPointerLeave={() => setMenu(false)}>
          <div className="menu-sub">{user.email}</div>
          <button className="menu-item" onClick={() => { setMenu(false); void signOutAccount(); }}><b>Sign out</b><span>projects stay in this browser</span></button>
        </div>
      )}
    </div>
  );
}
