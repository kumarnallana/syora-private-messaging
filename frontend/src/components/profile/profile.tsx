'use client';
import { useEffect, useRef, useState } from 'react';
import { AtSign, Camera, LoaderCircle, Mail, Save } from 'lucide-react';
import { useApp } from '@/stores/use-app';
import { Avatar, pickAttachment } from '@/components/shared/ui';
import { MobileScreenHeader, PageHeader, PreviewNote } from '@/components/shell';

export function Profile() {
  const { me, services } = useApp();
  const [name, setName] = useState(me!.name);
  const [username, setUsername] = useState(me!.username);
  const [about, setAbout] = useState(me!.about);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string }>();
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const temporary = useRef<string>();
  useEffect(() => () => { if (temporary.current) URL.revokeObjectURL(temporary.current); }, []);

  async function photo(file?: File) {
    if (!file || busy) return;
    setBusy(true); setNotice(undefined);
    try {
      const item = pickAttachment(file);
      if (item.type !== 'image') { URL.revokeObjectURL(item.url); throw new Error('Choose an image for your profile photo.'); }
      if (temporary.current) URL.revokeObjectURL(temporary.current);
      temporary.current = item.url;
      await services.updateProfile({ avatar: item.url });
      setNotice({ kind: 'success', text: 'Profile photo updated.' });
    } catch (cause) { setNotice({ kind: 'error', text: cause instanceof Error ? cause.message : 'Profile photo could not be updated.' }); }
    finally { setBusy(false); }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    const normalized = username.trim().replace(/^@/, '').toLowerCase();
    if (!name.trim()) { setNotice({ kind: 'error', text: 'Enter your display name.' }); return; }
    if (!/^[a-z0-9_]{3,32}$/.test(normalized)) { setNotice({ kind: 'error', text: 'Use 3–32 lowercase letters, numbers, or underscores for your username.' }); return; }
    setBusy(true); setNotice(undefined);
    try { await services.updateProfile({ name: name.trim(), username: normalized, about: about.trim() }); setUsername(normalized); setNotice({ kind: 'success', text: 'Profile saved.' }); }
    catch (cause) { setNotice({ kind: 'error', text: cause instanceof Error ? cause.message : 'Profile could not be saved.' }); }
    finally { setBusy(false); }
  }

  return <div className="page-view is-narrow"><MobileScreenHeader title="Profile" backHref="/settings"/><PageHeader eyebrow="YOUR PROFILE" title="Make it yours" description="Choose how people in your circle recognize you."/><div className="profile-editor"><div className="avatar-editor"><Avatar user={me!} size="large"/><button type="button" className="icon-button" disabled={busy} onClick={() => input.current?.click()} aria-label="Change profile photo"><Camera size={19}/></button><input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { void photo(event.target.files?.[0]); event.target.value = ''; }}/></div><form onSubmit={save}><label className="field">Display name<input value={name} maxLength={80} onChange={event => setName(event.target.value)} required/></label><label className="field">Username<span className="input-with-icon"><AtSign size={17}/><input value={username} maxLength={32} autoComplete="username" onChange={event => setUsername(event.target.value)} required/></span><small>Your unique username helps people find you.</small></label><label className="field">About<textarea value={about} maxLength={160} onChange={event => setAbout(event.target.value)} placeholder="A little about you"/></label><label className="field">Email<div className="readonly-field"><Mail size={17}/><span>{me!.email}</span></div></label>{notice && <p className={`notice is-${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>}<button className="button primary" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17}/> : <Save size={17}/>} {busy ? 'Saving…' : 'Save profile'}</button></form></div><PreviewNote/></div>;
}
