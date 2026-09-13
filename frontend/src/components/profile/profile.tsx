'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, AtSign, Camera, LoaderCircle, Mail, RotateCcw, Save } from 'lucide-react';
import { useApp } from '@/stores/use-app';
import { Avatar, pickAttachment } from '@/components/shared/ui';
import { MobileScreenHeader, PageHeader } from '@/components/shell';
import { normalizeUsername } from '@/utils/presentation';

type Notice = { kind: 'success' | 'error'; text: string };

export function Profile() {
  const { me, services } = useApp();
  const [name, setName] = useState(me!.name);
  const [username, setUsername] = useState(normalizeUsername(me!.username));
  const [about, setAbout] = useState(me!.about);
  const [notice, setNotice] = useState<Notice>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState(0);
  const [failedPhoto, setFailedPhoto] = useState<File>();
  const [preview, setPreview] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  const temporary = useRef<string | null>(null);
  const normalized = normalizeUsername(username);
  const dirty = name.trim() !== me!.name || normalized !== normalizeUsername(me!.username) || about.trim() !== me!.about;
  const busy = saving || uploading;

  useEffect(() => () => { if (temporary.current) URL.revokeObjectURL(temporary.current); }, []);
  useEffect(() => {
    if (!dirty && !busy) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [busy, dirty]);

  async function photo(file?: File) {
    if (!file || busy) return;
    setUploading(true);
    setAvatarProgress(0);
    setNotice(undefined);
    setFailedPhoto(file);
    try {
      const item = pickAttachment(file);
      if (item.type !== 'image') {
        URL.revokeObjectURL(item.url);
        throw new Error('Choose a JPG, PNG, or WebP image for your profile photo.');
      }
      if (temporary.current) URL.revokeObjectURL(temporary.current);
      temporary.current = item.url;
      setPreview(item.url);
      await services.updateProfile({ avatar: item.url }, setAvatarProgress);
      setFailedPhoto(undefined);
      setNotice({ kind: 'success', text: 'Profile photo updated.' });
      URL.revokeObjectURL(item.url);
      temporary.current = null;
      setPreview(undefined);
    } catch (cause) {
      setNotice({ kind: 'error', text: cause instanceof Error ? cause.message : 'Profile photo could not be updated.' });
    } finally {
      setUploading(false);
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !dirty) return;
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = 'Enter your display name.';
    if (!/^[a-z0-9_]{3,32}$/.test(normalized)) nextErrors.username = 'Use 3–32 lowercase letters, numbers, or underscores.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true);
    setNotice(undefined);
    try {
      await services.updateProfile({ name: name.trim(), username: normalized, about: about.trim() });
      setUsername(normalized);
      setNotice({ kind: 'success', text: 'Profile saved.' });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Profile could not be saved.';
      if (/username|handle|taken/i.test(message)) setErrors({ username: message });
      setNotice({ kind: 'error', text: message });
    } finally {
      setSaving(false);
    }
  }

  const avatarUser = { ...me!, avatar: preview || me!.avatar };
  return (
    <div className="page-view is-narrow profile-page">
      <MobileScreenHeader title="Profile" backHref="/settings" />
      <PageHeader title="Profile" description="Choose how people in your circle recognize you." />
      <div className="profile-editor">
        <div className="avatar-column">
          <div className="avatar-editor">
            <Avatar user={avatarUser} size="large" />
            <button type="button" className="icon-button" disabled={busy} onClick={() => input.current?.click()} aria-label="Change profile photo"><Camera size={19} /></button>
            <input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { void photo(event.target.files?.[0]); event.target.value = ''; }} />
          </div>
          <div className="profile-identity"><strong>{name.trim() || me!.name}</strong><span>@{normalized || normalizeUsername(me!.username)}</span></div>
          {uploading && <div className="avatar-progress" role="status"><span>Uploading photo… {avatarProgress}%</span><progress max={100} value={avatarProgress} /></div>}
          {failedPhoto && !uploading && <button type="button" className="button secondary small" onClick={() => void photo(failedPhoto)}><RotateCcw size={15} /> Retry photo upload</button>}
        </div>
        <form onSubmit={save} aria-busy={saving}>
          <label className={`field ${errors.name ? 'has-error' : ''}`}>Display name
            <input value={name} maxLength={80} disabled={busy} autoComplete="name" onChange={event => { setName(event.target.value); setErrors(value => ({ ...value, name: '' })); setNotice(undefined); }} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'profile-name-error' : undefined} required />
            {errors.name && <small id="profile-name-error" className="field-error" role="alert"><AlertCircle size={14} />{errors.name}</small>}
          </label>
          <label className={`field ${errors.username ? 'has-error' : ''}`}>Username
            <span className="username-control"><span className="username-prefix" aria-hidden="true"><AtSign size={17} /></span><input value={username} maxLength={32} disabled={busy} autoComplete="off" autoCapitalize="none" spellCheck={false} onChange={event => { setUsername(normalizeUsername(event.target.value)); setErrors(value => ({ ...value, username: '' })); setNotice(undefined); }} aria-invalid={Boolean(errors.username)} aria-describedby={errors.username ? 'profile-username-error' : 'profile-username-help'} required /></span>
            {errors.username ? <small id="profile-username-error" className="field-error" role="alert"><AlertCircle size={14} />{errors.username}</small> : <small id="profile-username-help">Lowercase letters, numbers, and underscores · 3–32 characters</small>}
          </label>
          <label className="field about-field"><span className="field-label-row"><span>About</span><small>{about.length}/160</small></span><textarea rows={3} value={about} maxLength={160} disabled={busy} onChange={event => { setAbout(event.target.value); setNotice(undefined); }} placeholder="A little about you" /></label>
          <div className="account-email"><span className="account-email__label">Account email</span><div className="readonly-field"><Mail size={17} /><span>{me!.email}</span></div><small>Only you can see this address.</small></div>
          {notice && <p className={`notice is-${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>}
          <div className="profile-actions"><span className="profile-save-state" aria-live="polite">{saving ? 'Saving your changes…' : dirty ? 'Unsaved changes' : notice?.kind === 'success' ? 'Saved' : 'Up to date'}</span><button className="button primary" type="submit" disabled={busy || !dirty}>{saving ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />} {saving ? 'Saving…' : 'Save profile'}</button></div>
        </form>
      </div>
    </div>
  );
}
