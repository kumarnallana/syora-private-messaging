'use client';

import { useRouter } from 'next/navigation';
import { Bell, ChevronRight, LoaderCircle, Lock, LogOut, Monitor, Moon, Shield, Sun, UserRound, UserX } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '@/stores/use-app';
import { Avatar, Modal } from '@/components/shared/ui';
import { MobileScreenHeader, PageHeader, PreviewNote } from '@/components/shell';
import { usernameLabel } from '@/utils/presentation';
import type { Preferences } from '@/types';

type Subsection = 'privacy' | 'notifications' | 'appearance' | 'blocked';

export function Settings() {
  const { me, users, services, preferences } = useApp();
  const router = useRouter();
  const [logout, setLogout] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string }>();
  const [section, setSection] = useState<Subsection>();
  const [pending, setPending] = useState<keyof Preferences>();
  const [blockingId, setBlockingId] = useState<string>();

  async function update(key: keyof Preferences, value: unknown) {
    if (pending) return;
    setPending(key);
    setNotice(undefined);
    try { await services.updatePreferences({ [key]: value }); setNotice({ kind: 'success', text: 'Settings updated.' }); }
    catch (cause) { setNotice({ kind: 'error', text: cause instanceof Error ? cause.message : 'This setting could not be updated.' }); }
    finally { setPending(undefined); }
  }

  async function unblock(id: string, name: string) {
    if (blockingId) return;
    setBlockingId(id); setNotice(undefined);
    try { await services.block(id); setNotice({ kind: 'success', text: `${name} is unblocked.` }); }
    catch (cause) { setNotice({ kind: 'error', text: cause instanceof Error ? cause.message : 'This person could not be unblocked.' }); }
    finally { setBlockingId(undefined); }
  }

  const privacy = <><Choice disabled={Boolean(pending)} label="Last seen" value={preferences.lastSeen} options={['Everyone','Friends','Nobody']} onChange={value => void update('lastSeen', value)}/><Choice disabled={Boolean(pending)} label="Profile photo" value={preferences.photo} options={['Everyone','Friends','Nobody']} onChange={value => void update('photo', value)}/><Choice disabled={Boolean(pending)} label="Status visibility" value={preferences.status} options={['Friends','Nobody']} onChange={value => void update('status', value)}/><Toggle disabled={Boolean(pending)} label="Read receipts" description="Let friends know when you have read a message." value={preferences.receipts} onChange={value => void update('receipts', value)}/></>;
  const notifications = <><Toggle disabled={Boolean(pending)} label="Message notifications" description="Show alerts for new messages." value={preferences.notifications} onChange={value => void update('notifications', value)}/><Toggle disabled={Boolean(pending)} label="Conversation sounds" description="Play a sound for message activity." value={preferences.sound} onChange={value => void update('sound', value)}/></>;
  const appearance = <><div className="theme-options" role="radiogroup" aria-label="Appearance">{([['dark', Moon, 'Dark'], ['light', Sun, 'Light'], ['system', Monitor, 'System']] as const).map(([value, Icon, label]) => <button key={value} disabled={Boolean(pending)} role="radio" aria-checked={preferences.appearance === value} className={preferences.appearance === value ? 'is-active' : ''} onClick={() => void update('appearance', value)}><Icon size={18}/> {label}</button>)}</div><Toggle disabled={Boolean(pending)} label="Compact conversations" description="Reduce spacing in conversation lists and messages." value={preferences.compact} onChange={value => void update('compact', value)}/></>;
  const blocked = preferences.blocked.length ? preferences.blocked.map(id => { const user = users.find(item => item.id === id); return user && <div className="blocked-row" key={id}><Avatar user={user} size="small"/><span>{user.name}</span><button className="button secondary small" disabled={Boolean(blockingId)} onClick={() => void unblock(id, user.name)}>{blockingId === id && <LoaderCircle className="spin" size={15}/>} Unblock</button></div>; }) : <p className="muted-copy">You have not blocked anyone.</p>;
  const subsectionContent = section === 'privacy' ? privacy : section === 'notifications' ? notifications : section === 'appearance' ? appearance : blocked;
  const subsectionTitle = section ? section[0].toUpperCase() + section.slice(1) : '';

  return <div className="page-view settings-page"><MobileScreenHeader title={subsectionTitle || 'Settings'} onBack={section ? () => setSection(undefined) : undefined}/><PageHeader eyebrow="YOUR SPACE" title="Settings" description="Tune privacy, notifications, and appearance."/>{pending && <p className="settings-progress" role="status"><LoaderCircle className="spin" size={15}/> Saving setting…</p>}{notice && <p className={`notice settings-notice is-${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>}<div className="settings-mobile-main" hidden={Boolean(section)}><button className="mobile-account-row" onClick={() => router.push('/profile')}><Avatar user={me!}/><span className="account-copy"><strong>{me!.name}</strong><small>{usernameLabel(me!.username)}</small></span><ChevronRight size={20}/></button><nav className="settings-menu" aria-label="Settings sections"><SettingsLink icon={<UserRound/>} label="Account" onClick={() => router.push('/profile')}/><SettingsLink icon={<Lock/>} label="Privacy" onClick={() => setSection('privacy')}/><SettingsLink icon={<Bell/>} label="Notifications" onClick={() => setSection('notifications')}/><SettingsLink icon={<Moon/>} label="Appearance" onClick={() => setSection('appearance')}/><SettingsLink icon={<UserX/>} label={`Blocked users (${preferences.blocked.length})`} onClick={() => setSection('blocked')}/></nav><button className="settings-menu-row danger-text" onClick={() => setLogout(true)}><LogOut/><span>Log out</span><ChevronRight/></button></div>{section && <div className="settings-mobile-subscreen">{subsectionContent}</div>}<div className="settings-desktop-content"><SettingsSection icon={<Shield/>} title="Account"><div className="account-summary"><Avatar user={me!}/><span className="account-copy"><strong>{me!.name}</strong><small>{usernameLabel(me!.username)}</small></span><button className="button secondary small" onClick={() => router.push('/profile')}>Edit profile</button></div></SettingsSection><SettingsSection icon={<Lock/>} title="Privacy">{privacy}</SettingsSection><SettingsSection icon={<Bell/>} title="Notifications">{notifications}</SettingsSection><SettingsSection icon={<Moon/>} title="Appearance">{appearance}</SettingsSection><SettingsSection icon={<UserX/>} title={`Blocked users (${preferences.blocked.length})`}>{blocked}</SettingsSection><button className="button danger logout-setting" onClick={() => setLogout(true)}><LogOut size={18}/> Log out</button><PreviewNote/></div>{logout && <Modal title="Log out of SYORA?" className="mobile-sheet" onClose={() => setLogout(false)}><p className="modal-copy">You will need to sign in again to access your conversations.</p><div className="modal-actions"><button className="button secondary" onClick={() => setLogout(false)}>Cancel</button><button className="button danger" onClick={() => { services.logout(); router.push('/login'); }}>Log out</button></div></Modal>}</div>;
}

function SettingsLink({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) { return <button className="settings-menu-row" onClick={onClick}>{icon}<span>{label}</span><ChevronRight/></button>; }
function SettingsSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) { return <section className="settings-section"><header>{icon}<h2>{title}</h2></header><div>{children}</div></section>; }
function Toggle({ label, description, value, onChange, disabled }: { label: string; description: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) { return <div className="setting-row"><span><strong>{label}</strong><small>{description}</small></span><button disabled={disabled} className={`switch ${value ? 'is-on' : ''}`} role="switch" aria-checked={value} aria-label={label} onClick={() => onChange(!value)}><span/></button></div>; }
function Choice({ label, value, options, onChange, disabled }: { label: string; value: string; options: string[]; onChange: (value: string) => void; disabled?: boolean }) { return <label className="setting-row"><span><strong>{label}</strong></span><select disabled={disabled} value={value} onChange={event => onChange(event.target.value)} aria-label={label}>{options.map(option => <option key={option}>{option}</option>)}</select></label>; }
