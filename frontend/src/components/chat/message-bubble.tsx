'use client';

import { useEffect, useRef, useState } from 'react';
import { Copy, MoreHorizontal, Reply, RotateCcw, Trash2 } from 'lucide-react';
import { time, IconButton, Modal } from '@/components/shared/ui';
import { AttachmentContent } from '@/components/media/attachment';
import { useApp } from '@/stores/use-app';
import type { Message } from '@/types';
import { DeliveryReceipt } from './delivery-receipt';

const URL_PATTERN = /(https?:\/\/[^\s<]+)/g;
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\uFE0F|\u200D|\s){1,16}$/u;
function renderMessageText(text: string) {
  return text.split(URL_PATTERN).map((part, index) => part.startsWith('http://') || part.startsWith('https://') ? <a className="message-link" href={part} target="_blank" rel="noreferrer" key={part + ':' + index}>{part}</a> : part);
}

export function MessageBubble({ message, mine, original, onReply, groupedWithPrevious = false, groupedWithNext = false }: { message: Message; mine: boolean; original?: Message; onReply: () => void; groupedWithPrevious?: boolean; groupedWithNext?: boolean }) {
  const { services, users, me } = useApp();
  const [deleting, setDeleting] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [copied, setCopied] = useState(false);
  const actionMenu = useRef<HTMLDivElement>(null);
  const emojiOnly = Boolean(!message.attachment && !message.deleted && message.text.trim() && EMOJI_ONLY.test(message.text.trim()));

  useEffect(() => {
    if (!actionsOpen) return;
    const close = (event: PointerEvent) => {
      if (!actionMenu.current?.contains(event.target as Node)) setActionsOpen(false);
    };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setActionsOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', key); };
  }, [actionsOpen]);

  async function remove(everyone: boolean) {
    try { await services.deleteMessage(message.id, everyone); setDeleting(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The message could not be deleted.'); }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      setActionsOpen(false);
      window.setTimeout(() => setCopied(false), 1400);
    } catch { setError('Message could not be copied.'); }
  }

  return <article className={`message-row ${mine ? 'is-outgoing' : 'is-incoming'} ${groupedWithPrevious ? 'grouped' : ''} ${groupedWithNext ? 'continues' : ''}`} aria-label={mine ? 'Sent by you' : 'Received message'}>
    <div className={`message-bubble ${message.attachment ? 'with-media' : ''} ${emojiOnly ? 'is-emoji-only' : ''}`}>
      {message.replyTo && !message.deleted && <div className="reply-quote"><strong>{original?.senderId === me!.id ? 'You' : users.find(user => user.id === original?.senderId)?.name || 'Original message'}</strong><span>{!original ? 'Message unavailable' : original.deleted ? 'Message deleted' : original.text || original.attachment?.name}</span></div>}
      {message.deleted ? <p className="deleted-message"><Trash2 size={14} /> This message was deleted</p> : <>{message.attachment && <AttachmentContent attachment={message.attachment} />} {message.text && <p>{renderMessageText(message.text)}</p>}</>}
      <div className="message-meta"><time dateTime={message.createdAt}>{time(message.createdAt)}</time>{mine && !message.deleted && <DeliveryReceipt state={message.receipt} />}</div>
      {mine && message.receipt === 'failed' && !message.deleted && <button className="retry-button" disabled={retrying} onClick={async () => { setRetrying(true); try { await services.retry(message.id); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Message retry failed.'); } finally { setRetrying(false); } }}><RotateCcw size={14} /> Retry message</button>}
      {error && <p className="inline-error" role="alert">{error}</p>}
    </div>
    {!message.deleted && <div className="message-actions-wrap" ref={actionMenu}>
      <button type="button" className="icon-button message-action-trigger" aria-label="Message actions" aria-expanded={actionsOpen} onClick={() => setActionsOpen(value => !value)}><MoreHorizontal size={18} /></button>
      {actionsOpen && <div className="message-action-menu" role="menu">
        {message.text && <button type="button" role="menuitem" onClick={() => void copy()}><Copy size={17} /><span>{copied ? 'Copied' : 'Copy'}</span></button>}
        <button type="button" role="menuitem" onClick={() => { setActionsOpen(false); onReply(); }}><Reply size={17} /><span>Reply</span></button>
        <button type="button" role="menuitem" className="danger-text" onClick={() => { setActionsOpen(false); setDeleting(true); }}><Trash2 size={17} /><span>Delete</span></button>
      </div>}
    </div>}
    {deleting && <Modal title="Delete this message?" className="mobile-sheet" onClose={() => setDeleting(false)}><p className="modal-copy">Delete for me hides it from your account. Delete for everyone leaves a deleted-message notice.</p><div className="delete-choices"><button className="button secondary" onClick={() => void remove(false)}>Delete for me</button>{mine && !message.deleted && <button className="button danger" onClick={() => void remove(true)}>Delete for everyone</button>}<button className="button secondary" onClick={() => setDeleting(false)}>Cancel</button></div></Modal>}
  </article>;
}
