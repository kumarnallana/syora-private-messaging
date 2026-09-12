'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, Eye, EyeOff, Feather, LoaderCircle, MessageCircle, Users } from 'lucide-react';
import { Brand } from '@/components/shared/ui';
import { useApp } from '@/stores/use-app';

type Mode = 'login' | 'register' | 'forgot';
type Notice = { kind: 'error' | 'success'; text: string };

export function AuthScreen({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { services, me, sessionReady, sessionError } = useApp();
  const formId = useId();
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>();
  const register = mode === 'register';
  const forgot = mode === 'forgot';
  const demoEnabled = process.env.NEXT_PUBLIC_ENABLE_DEMO === 'true';

  useEffect(() => { if (sessionReady && me) router.replace('/chats'); }, [sessionReady, me, router]);

  function validate(next = values) {
    const result: Record<string, string> = {};
    if (register && !next.name?.trim()) result.name = 'Enter your display name.';
    if (register && !/^[a-z0-9_]{3,32}$/.test((next.username || '').replace(/^@/, '').toLowerCase())) result.username = 'Use 3–32 lowercase letters, numbers, or underscores.';
    if (!/^\S+@\S+\.\S+$/.test(next.email || '')) result.email = 'Enter a valid email address.';
    if ((next.password || '').length < 8) result.password = 'Use at least 8 characters.';
    if (register && next.confirm !== next.password) result.confirm = 'Passwords do not match.';
    return result;
  }
  function change(name: string, value: string) {
    const next = { ...values, [name]: value };
    setValues(next);
    if (touched[name]) setErrors(validate(next));
  }
  function blur(name: string) {
    setTouched(value => ({ ...value, [name]: true }));
    setErrors(validate());
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors = validate();
    setTouched({ name: true, username: true, email: true, password: true, confirm: true });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setBusy(true); setNotice(undefined);
    try {
      if (register) await services.register(values.name, values.username, values.email, values.password);
      else await services.login(values.email, values.password);
      router.push('/chats');
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Sign in could not be completed.' });
    } finally { setBusy(false); }
  }
  async function demo() {
    setBusy(true); setNotice(undefined);
    try { await services.enterDemo(); router.push('/chats'); }
    catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Demo access is unavailable.' }); }
    finally { setBusy(false); }
  }
  function inputField(name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) {
    const error = touched[name] ? errors[name] : undefined;
    const errorId = `${formId}-${name}-error`;
    return <label className={`field ${error ? 'has-error' : ''}`}>{label}<input {...props} value={values[name] || ''} onChange={event => change(name, event.target.value)} onBlur={() => blur(name)} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}/>{error && <small id={errorId} className="field-error" role="alert"><AlertCircle size={14}/>{error}</small>}</label>;
  }
  function passwordField(name: string, label: string) {
    const error = touched[name] ? errors[name] : undefined;
    const errorId = `${formId}-${name}-error`;
    return <label className={`field ${error ? 'has-error' : ''}`}>{label}<span className="input-wrap"><input type={show[name] ? 'text' : 'password'} value={values[name] || ''} onChange={event => change(name, event.target.value)} onBlur={() => blur(name)} autoComplete={register ? 'new-password' : 'current-password'} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}/><button type="button" className="password-toggle" aria-label={`${show[name] ? 'Hide' : 'Show'} ${label.toLowerCase()}`} onClick={() => setShow(value => ({ ...value, [name]: !value[name] }))}>{show[name] ? <EyeOff size={18}/> : <Eye size={18}/>}</button></span>{error && <small id={errorId} className="field-error" role="alert"><AlertCircle size={14}/>{error}</small>}</label>;
  }

  return <main className="auth-page"><section className="auth-story"><Brand/><div className="auth-copy"><span className="eyebrow">A LITTLE CLOSER. A LITTLE QUIETER.</span><h1>Your people.<br/>Your own <em>space.</em></h1><p>Private conversations.<br/>Real connection.</p><div className="auth-notes"><span><MessageCircle size={18}/> Conversations that matter</span><span><Users size={18}/> A circle you choose</span><span><Feather size={18}/> Room to be yourself</span></div></div><span className="auth-foot">Thoughtfully made for your inner circle.</span></section><section className="auth-form-wrap"><div className="auth-mobile-brand"><Brand/></div><div className="auth-form-shell"><div key={mode} className="auth-form auth-form-transition">{forgot && <Link href="/login" className="icon-button" aria-label="Back to login"><ArrowLeft/></Link>}<span className="eyebrow">WELCOME TO SYORA</span><h2>{register ? 'Make yourself at home.' : forgot ? 'Find your way back.' : 'Good to have you here.'}</h2><p>{register ? 'A new space for you and your people.' : forgot ? 'Password recovery is not available yet. Return to sign in to continue.' : 'Sign in to continue to your conversations.'}</p>{!forgot && <form onSubmit={submit} noValidate>{register && inputField('name', 'Display name', { autoComplete: 'name', autoFocus: true, maxLength: 80 })}{register && inputField('username', 'Username', { autoComplete: 'username', placeholder: '@username', maxLength: 32 })}{inputField('email', 'Email', { type: 'email', autoComplete: 'email', autoFocus: !register })}{passwordField('password', 'Password')}{register && passwordField('confirm', 'Confirm password')}{!register && <Link className="forgot-link" href="/forgot-password">Forgot password?</Link>}{notice && <p className={`notice is-${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>}{sessionError && <div className="auth-session-error" role="alert"><span>{sessionError}</span><button type="button" className="button secondary small" onClick={() => void services.retryBootstrap()}>Retry</button></div>}<button className="button primary full" disabled={busy || !sessionReady}>{busy && <LoaderCircle className="spin" size={17}/>} {register ? 'Create account' : 'Sign in'}</button></form>}{!forgot && <p className="auth-switch">{register ? 'Already have an account?' : 'New to SYORA?'} <Link href={register ? '/login' : '/register'}>{register ? 'Sign in' : 'Create account'}</Link></p>}{demoEnabled && !forgot && <><div className="divider"><span>or take a look around</span></div><button className="button secondary full" onClick={demo} disabled={busy || !sessionReady}>Explore the demo <ArrowRight size={17}/></button></>}<p className="demo-disclosure">Protected by a short-lived session and a secure rotating sign-in cookie.</p></div></div></section></main>;
}
