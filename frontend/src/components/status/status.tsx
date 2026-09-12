'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, LoaderCircle, Plus, Trash2 } from 'lucide-react';
import { useApp } from '@/stores/use-app';
import { Avatar, Empty, IconButton, Modal, relative } from '@/components/shared/ui';
import { MobileScreenHeader, PageHeader, PreviewNote } from '@/components/shell';
import { AttachmentContent, FilePicker } from '@/components/media/attachment';
import type { Attachment, StatusPost, User } from '@/types';

export function Status() {
  const { me, users, statuses, services, preferences } = useApp();
  const activeStatuses = statuses.filter(status => new Date(status.expiresAt).getTime() > Date.now());
  const [active, setActive] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [text, setText] = useState('');
  const [color, setColor] = useState('#4c3f66');
  const [attachment, setAttachment] = useState<Attachment>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [deletingId, setDeletingId] = useState<string>();
  const mine = activeStatuses.filter(status => status.userId === me!.id);
  const friends = activeStatuses.filter(status => status.userId !== me!.id);
  const recent = friends.filter(status => !status.viewedBy.includes(me!.id));
  const viewed = friends.filter(status => status.viewedBy.includes(me!.id));

  function closeCreate() {
    if (attachment?.url.startsWith('blob:')) URL.revokeObjectURL(attachment.url);
    setAttachment(undefined); setText(''); setError(''); setProgress(0); setCreating(false);
  }

  async function publish() {
    if (busy || (!text.trim() && !attachment)) return;
    setBusy(true); setProgress(attachment ? 0 : 100); setError('');
    try {
      await services.publish(text, color, attachment, setProgress);
      if (attachment?.url.startsWith('blob:')) URL.revokeObjectURL(attachment.url);
      setAttachment(undefined); setText(''); setCreating(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Your status could not be shared. Try again.'); }
    finally { setBusy(false); }
  }

  async function remove(status: StatusPost) {
    if (deletingId) return;
    setDeletingId(status.id); setError('');
    try { await services.removeStatus(status.id); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'This status could not be deleted.'); }
    finally { setDeletingId(undefined); }
  }

  const move = useCallback((step: number) => {
    setActive(index => {
      if (index === null) return null;
      const next = index + step;
      if (next < 0) return 0;
      return next >= activeStatuses.length ? null : next;
    });
  }, [activeStatuses.length]);

  return <div className="page-view status-page"><MobileScreenHeader title="Status" action={<IconButton label="Add status" onClick={() => setCreating(true)}><Plus size={20}/></IconButton>}/><PageHeader eyebrow="MOMENTS" title="Status" description="Share a photo, video, or thought. Statuses expire after 24 hours." action={<button className="button primary" onClick={() => setCreating(true)}><Plus size={18}/> Add status</button>}/>{error && !creating && <p className="inline-error" role="alert">{error}</p>}<section><h2 className="section-heading">My Status <span>{mine.length}</span></h2>{mine.length ? <div className="status-grid">{mine.map(status => <StatusCard key={status.id} status={status} user={me!} own busy={deletingId === status.id} onOpen={() => setActive(activeStatuses.indexOf(status))} onDelete={() => void remove(status)}/>)}</div> : <Empty title="Share a moment" description="Add a text, photo, or video status for your friends."><button className="button primary" onClick={() => setCreating(true)}><Plus size={17}/> Share status</button></Empty>}</section><section><h2 className="section-heading">Recent updates <span>{recent.length}</span></h2>{recent.length ? <div className="status-grid">{recent.map(status => { const user = users.find(item => item.id === status.userId)!; return <StatusCard key={status.id} status={status} user={user} onOpen={() => { void services.view(status.id).catch(cause => setError(cause instanceof Error ? cause.message : 'This status could not be opened.')); setActive(activeStatuses.indexOf(status)); }}/>; })}</div> : <Empty title="Nothing new yet" description="Friend updates will appear here."/>}</section>{viewed.length > 0 && <section><h2 className="section-heading">Viewed updates <span>{viewed.length}</span></h2><div className="status-grid">{viewed.map(status => { const user = users.find(item => item.id === status.userId)!; return <StatusCard key={status.id} status={status} user={user} onOpen={() => setActive(activeStatuses.indexOf(status))}/>; })}</div></section>}<PreviewNote/>{creating && <Modal title="Create status" className="mobile-sheet" onClose={() => { if (!busy) closeCreate(); }}><div className="status-compose" style={{ background: color }}>{attachment ? <AttachmentContent attachment={attachment}/> : <p>{text || 'Your thought goes here.'}</p>}</div><label className="field">Text<textarea aria-label="Status text" maxLength={500} value={text} onChange={event => setText(event.target.value)} placeholder="What’s on your mind?" readOnly={busy}/></label><div className="status-tools"><FilePicker mediaOnly onSelect={file => { setAttachment(file); setError(''); }} onError={setError} disabled={busy}/>{['#4c3f66','#31525a','#5b3d45','#594a35','#334c42'].map(value => <button type="button" key={value} disabled={busy} aria-label={`Use ${value} background`} aria-pressed={color === value} className="color-choice" style={{ background: value }} onClick={() => setColor(value)}/>)}</div>{busy && attachment && <div className="status-upload" role="status"><span>Uploading… {progress}%</span><progress max={100} value={progress}/></div>}{error && <p className="inline-error" role="alert">{error}</p>}<p className="demo-disclosure">{preferences.status === 'Friends' ? 'Visible to your friends for 24 hours.' : 'Status sharing is hidden by your current privacy setting.'}</p><div className="modal-actions"><button className="button secondary" disabled={busy} onClick={closeCreate}>Cancel</button><button className="button primary" disabled={busy || (!text.trim() && !attachment)} onClick={publish}>{busy && <LoaderCircle className="spin" size={17}/>} {busy ? attachment ? 'Uploading…' : 'Sharing…' : error ? 'Try again' : 'Share status'}</button></div></Modal>}{active !== null && activeStatuses[active] && <StatusViewer index={active} total={activeStatuses.length} status={activeStatuses[active]} user={users.find(user => user.id === activeStatuses[active].userId)!} onClose={() => setActive(null)} onMove={move}/>}</div>;
}

function StatusCard({ status, user, onOpen, onDelete, own = false, busy = false }: { status: StatusPost; user: User; onOpen: () => void; onDelete?: () => void; own?: boolean; busy?: boolean }) { return <article className="status-card"><button className="status-open" onClick={onOpen} aria-label={`View ${own ? 'your' : `${user.name}'s`} status`}><span className="status-ring"><Avatar user={user}/></span><span><strong>{own ? 'My Status' : user.name}</strong><small>{relative(status.createdAt)}</small><p>{status.text || status.attachment?.name}</p></span></button>{onDelete && <IconButton disabled={busy} label="Delete status" onClick={onDelete}>{busy ? <LoaderCircle className="spin" size={17}/> : <Trash2 size={17}/>}</IconButton>}</article>; }

function StatusViewer({ status, user, index, total, onClose, onMove }: { status: StatusPost; user: User; index: number; total: number; onClose: () => void; onMove: (step: number) => void }) { useEffect(() => { const key = (event: KeyboardEvent) => { if (event.key === 'ArrowLeft') onMove(-1); if (event.key === 'ArrowRight') onMove(1); if (event.key === 'Escape') onClose(); }; addEventListener('keydown', key); const timer = setTimeout(() => onMove(1), 5000); return () => { removeEventListener('keydown', key); clearTimeout(timer); }; }, [index, onClose, onMove]); return <Modal title={`${user.name}'s status`} wide className="status-viewer-dialog" onClose={onClose}><div className="status-progress" aria-label={`Status ${index + 1} of ${total}`}>{Array.from({ length: total }, (_, item) => <span key={item} className={item < index ? 'is-complete' : item === index ? 'is-active' : ''}/>)}</div><div className="viewer-person"><Avatar user={user} size="small"/><span><strong>{user.name}</strong><small>{relative(status.createdAt)}</small></span></div><div className="status-viewer" style={{ background: status.color }}>{status.attachment ? <AttachmentContent attachment={status.attachment}/> : <p>{status.text}</p>}</div><div className="viewer-controls"><IconButton label="Previous status" disabled={index === 0} onClick={() => onMove(-1)}><ChevronLeft/></IconButton><span>{index + 1} / {total}</span><IconButton label={index === total - 1 ? 'Close status viewer' : 'Next status'} onClick={() => index === total - 1 ? onClose() : onMove(1)}><ChevronRight/></IconButton></div></Modal>; }
