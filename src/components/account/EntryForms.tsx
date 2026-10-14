'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { login, register, useAuth } from '@/lib/client/auth';
import { gql } from '@/lib/client/gql';

/** Sign in, create account and forgot password: the classic store's entry pages, same fields and wording. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const REQ = 'This is a required field.';

/** Only same-site paths are allowed as a return target. */
function returnTo(): string {
  if (typeof window === 'undefined') return '/customer/account/';
  const r = new URLSearchParams(location.search).get('return') ?? '';
  return /^\/(?!\/)[\w\-./?=&%]*$/.test(r) ? r : '/customer/account/';
}

function Field({
  id,
  label,
  value,
  set,
  error,
  type = 'text',
  ...rest
}: { id: string; label: string; value: string; set: (v: string) => void; error?: string; type?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="ts-field is-required">
      <label htmlFor={id}>{label}</label>
      <input id={id} type={type} value={value} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} onChange={(e) => set(e.target.value)} {...rest} />
      {error && (
        <p className="ts-field-error" id={`${id}-err`}>
          {error}
        </p>
      )}
    </div>
  );
}

function Alert({ msg, ok = false }: { msg: string | null; ok?: boolean }) {
  if (!msg) return null;
  return (
    <p className={`ts-alert${ok ? ' ts-alert--ok' : ''}`} role={ok ? 'status' : 'alert'}>
      {msg}
    </p>
  );
}

export function LoginView() {
  const router = useRouter();
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<{ email?: string; pw?: string }>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (auth.loggedIn && !busy) router.replace(returnTo());
  }, [auth.loggedIn, busy, router]);

  return (
    <>
      <div className="ts-entry-title">
        <h1>Sign in</h1>
      </div>
      <div className="ts-login">
        <section className="ts-card-box" aria-labelledby="ts-login-h">
          <h2 id="ts-login-h">Returning customers</h2>
          <p className="ts-entry-lede">If you have an account, sign in with your email address.</p>
          <Alert msg={msg} />
          <form
            noValidate
            onSubmit={async (e) => {
              e.preventDefault();
              const x: typeof err = {};
              if (!email.trim()) x.email = REQ;
              else if (!EMAIL_RE.test(email.trim())) x.email = 'Please enter a valid email address (Ex: johndoe@domain.com).';
              if (!pw) x.pw = REQ;
              setErr(x);
              if (Object.keys(x).length) return;
              setBusy(true);
              setMsg(null);
              const r = await login(email.trim(), pw);
              if (r.ok) {
                router.replace(returnTo());
                return;
              }
              setBusy(false);
              setMsg(r.message ?? 'The account sign-in was incorrect or your account is disabled temporarily. Please wait and try again later.');
            }}
          >
            <Field id="login-email" label="Email" type="email" value={email} set={setEmail} error={err.email} autoComplete="email" />
            <Field id="login-pass" label="Password" type={show ? 'text' : 'password'} value={pw} set={setPw} error={err.pw} autoComplete="current-password" />
            <label className="ts-check">
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
              Show password
            </label>
            <div className="ts-actions">
              <button type="submit" className="ts-button" disabled={busy}>
                {busy ? 'Signing in' : 'Sign in'}
              </button>
              <Link className="ts-textlink" href="/customer/account/forgotpassword/">
                Forgot your password?
              </Link>
            </div>
            <p className="ts-req-note">* Required fields</p>
          </form>
        </section>
        <section className="ts-card-box ts-card-box--oat" aria-labelledby="ts-new-h">
          <h2 id="ts-new-h">New customers</h2>
          <p>Creating an account has many benefits: check out faster, keep more than one address, track orders and more.</p>
          <Link className="ts-button" href="/customer/account/create/">
            Create an account
          </Link>
        </section>
      </div>
    </>
  );
}

function strength(pw: string): { s: 0 | 1 | 2 | 3; label: string } {
  if (!pw) return { s: 0, label: 'No password' };
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (pw.length < 8 || classes < 3) return { s: 1, label: 'Weak' };
  if (pw.length < 12) return { s: 2, label: 'Medium' };
  return { s: 3, label: 'Strong' };
}

export function CreateView() {
  const router = useRouter();
  const auth = useAuth();
  const [f, setF] = useState({ firstname: '', lastname: '', email: '', pw: '', pw2: '' });
  const [news, setNews] = useState(false);
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<Partial<Record<keyof typeof f, string>>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const st = strength(f.pw);
  const up = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });

  useEffect(() => {
    if (auth.loggedIn && !busy) router.replace('/customer/account/');
  }, [auth.loggedIn, busy, router]);

  return (
    <>
      <div className="ts-entry-title">
        <h1>Create an account</h1>
      </div>
      <form
        className="ts-entry-form"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          const x: typeof err = {};
          for (const k of ['firstname', 'lastname', 'email', 'pw', 'pw2'] as const) if (!f[k].trim()) x[k] = REQ;
          if (f.email.trim() && !EMAIL_RE.test(f.email.trim())) x.email = 'Please enter a valid email address (Ex: johndoe@domain.com).';
          if (f.pw && st.s < 2 && f.pw.length < 8) x.pw = 'Minimum length of this field must be equal or greater than 8 symbols.';
          else if (f.pw && [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(f.pw)).length < 3)
            x.pw = 'Minimum of different classes of characters in password is 3. Classes of characters: Lower Case, Upper Case, Digits, Special Characters.';
          if (f.pw2 && f.pw2 !== f.pw) x.pw2 = 'Please enter the same value again.';
          setErr(x);
          if (Object.keys(x).length) return;
          setBusy(true);
          setMsg(null);
          const r = await register({ firstname: f.firstname.trim(), lastname: f.lastname.trim(), email: f.email.trim(), password: f.pw, newsletter: news });
          if (r.ok) {
            router.replace('/customer/account/?welcome=1');
            return;
          }
          setBusy(false);
          setMsg(r.message ?? 'We could not create the account. Please try again.');
        }}
      >
        <Alert msg={msg} />
        <section className="ts-card-box" aria-labelledby="ts-pi-h">
          <h2 id="ts-pi-h">Personal information</h2>
          <Field id="c-first" label="First name" value={f.firstname} set={up('firstname')} error={err.firstname} autoComplete="given-name" />
          <Field id="c-last" label="Last name" value={f.lastname} set={up('lastname')} error={err.lastname} autoComplete="family-name" />
          <label className="ts-check">
            <input type="checkbox" checked={news} onChange={(e) => setNews(e.target.checked)} />
            Sign up for the newsletter
          </label>
        </section>
        <section className="ts-card-box" aria-labelledby="ts-si-h">
          <h2 id="ts-si-h">Sign-in information</h2>
          <Field id="c-email" label="Email" type="email" value={f.email} set={up('email')} error={err.email} autoComplete="email" />
          <Field id="c-pass" label="Password" type={show ? 'text' : 'password'} value={f.pw} set={up('pw')} error={err.pw} autoComplete="new-password" />
          <p className="ts-strength" data-s={st.s} aria-live="polite">
            Password strength: {st.label}
          </p>
          <Field id="c-pass2" label="Confirm password" type={show ? 'text' : 'password'} value={f.pw2} set={up('pw2')} error={err.pw2} autoComplete="new-password" />
          <label className="ts-check">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
            Show password
          </label>
          <p className="ts-req-note">* Required fields</p>
          <div className="ts-actions ts-actions--stack">
            <button type="submit" className="ts-button" disabled={busy}>
              {busy ? 'Creating account' : 'Create an account'}
            </button>
            <Link className="ts-textlink" href="/customer/account/login/">
              Back
            </Link>
          </div>
        </section>
      </form>
    </>
  );
}

export function ForgotView() {
  const [email, setEmail] = useState('');
  const [err, setErr] = useState<string | undefined>();
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <div className="ts-entry-title">
        <h1>Forgot your password?</h1>
      </div>
      <form
        className="ts-entry-form"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          const v = email.trim();
          if (!v) return setErr(REQ);
          if (!EMAIL_RE.test(v)) return setErr('Please enter a valid email address (Ex: johndoe@domain.com).');
          setErr(undefined);
          setBusy(true);
          try {
            await gql(`mutation ($e: String!) { requestPasswordResetEmail(email: $e) }`, { e: v });
          } catch {
            /* same answer either way: never reveal whether an account exists */
          }
          setBusy(false);
          setDone(`If there is an account associated with ${v} you will receive an email with a link to reset your password.`);
        }}
      >
        <Alert msg={done} ok />
        <section className="ts-card-box">
          <p className="ts-entry-lede">Please enter your email address below to receive a password reset link.</p>
          <Field id="f-email" label="Email" type="email" value={email} set={setEmail} error={err} autoComplete="email" />
          <div className="ts-actions ts-actions--stack">
            <button type="submit" className="ts-button" disabled={busy}>
              Reset my password
            </button>
            <Link className="ts-textlink" href="/customer/account/login/">
              Go back
            </Link>
          </div>
        </section>
      </form>
    </>
  );
}
