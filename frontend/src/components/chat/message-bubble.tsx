'use client';

import { type CSSProperties, type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';
import { Copy, MoreHorizontal, Reply, RotateCcw, Trash2 } from 'lucide-react';
import { time, IconButton, Modal } from '@/components/shared/ui';
import { AttachmentContent } from '@/components/media/attachment';
import { useApp } from '@/stores/use-app';
import type { Message } from '@/types';
import { DeliveryReceipt } from './delivery-receipt';

const URL_PATTERN = /(https?:\/\/[^\s<]+)/g;
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\uFE0F|\u200D|\s){1,16}$/u;
const SWIPE_REPLY_THRESHOLD = 52;
const SWIPE_REPLY_LIMIT = 76;

type SwipeGesture = {
  pointerId: number;
  startX: number;
  startY: number;
  offset: number;
  ready: boolean;
  axis: 'pending' | 'horizontal' | 'vertical';
};
function renderMessageText(text: string) {
  return text.split(URL_PATTERN).map((part, index) => part.startsWith('http://') || part.startsWith('https://') ? <a className="message-link" href={part} target="_blank" rel="noreferrer" key={part + ':' + index}>{part}</a> : part);
}

export function MessageBubble({ message, mine, original, onReply, onOpenReply, groupedWithPrevious = false, groupedWithNext = false }: { message: Message; mine: boolean; original?: Message; onReply: () => void; onOpenReply?: () => void; groupedWithPrevious?: boolean; groupedWithNext?: boolean }) {
  const { services, users, me } = useApp();
  const [deleting, setDeleting] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const actionMenu = useRef<HTMLDivElement>(null);
  const swipeGesture = useRef<SwipeGesture | undefined>(undefined);
  const longPressTimer = useRef<number | undefined>(undefined);
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

  useEffect(() => () => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
  }, []);

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

  function clearLongPress() {
    if (!longPressTimer.current) return;
    window.clearTimeout(longPressTimer.current);
    longPressTimer.current = undefined;
  }

  function beginSwipe(event: ReactPointerEvent<HTMLDivElement>) {
    if (message.deleted || event.pointerType === 'mouse' || event.button !== 0) return;
    if ((event.target as HTMLElement).closest('a, button, input, textarea, video')) return;
    const pointerId = event.pointerId;
    clearLongPress();
    swipeGesture.current = { pointerId, startX: event.clientX, startY: event.clientY, offset: 0, ready: false, axis: 'pending' };
    if (event.pointerType === 'touch') {
      longPressTimer.current = window.setTimeout(() => {
        const gesture = swipeGesture.current;
        if (!gesture || gesture.pointerId !== pointerId || gesture.axis !== 'pending') return;
        swipeGesture.current = undefined;
        longPressTimer.current = undefined;
        navigator.vibrate?.(12);
        setActionsOpen(true);
      }, 480);
    }
  }

  function moveSwipe(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = swipeGesture.current;
    if (!gesture || gesture.pointerId !== event.pointerId || gesture.axis === 'vertical') return;
    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;
    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) >= 7) clearLongPress();
    if (gesture.axis === 'pending') {
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 7) return;
      if (deltaX <= 0 || Math.abs(deltaY) >= Math.abs(deltaX)) {
        gesture.axis = 'vertical';
        return;
      }
      gesture.axis = 'horizontal';
      event.currentTarget.setPointerCapture(event.pointerId);
      setSwiping(true);
    }
    if (event.cancelable) event.preventDefault();
    const resisted = deltaX <= SWIPE_REPLY_THRESHOLD ? deltaX : SWIPE_REPLY_THRESHOLD + (deltaX - SWIPE_REPLY_THRESHOLD) * 0.28;
    gesture.offset = Math.max(0, Math.min(SWIPE_REPLY_LIMIT, resisted));
    const ready = gesture.offset >= SWIPE_REPLY_THRESHOLD;
    if (ready && !gesture.ready) navigator.vibrate?.(5);
    gesture.ready = ready;
    setSwipeOffset(gesture.offset);
  }

  function finishSwipe(event: ReactPointerEvent<HTMLDivElement>, cancelled = false) {
    clearLongPress();
    const gesture = swipeGesture.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const shouldReply = !cancelled && gesture.axis === 'horizontal' && gesture.offset >= SWIPE_REPLY_THRESHOLD;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    swipeGesture.current = undefined;
    setSwiping(false);
    setSwipeOffset(0);
    if (shouldReply) {
      navigator.vibrate?.(8);
      onReply();
    }
  }

  const swipeStyle = {
    '--swipe-offset': `${swipeOffset}px`,
    '--swipe-progress': Math.min(1, swipeOffset / SWIPE_REPLY_THRESHOLD),
  } as CSSProperties;
  const replyAuthor = original?.senderId === me!.id ? 'You' : users.find(user => user.id === original?.senderId)?.name || 'Original message';
  const replyText = !original ? 'Message unavailable' : original.deleted ? 'Message deleted' : original.text || original.attachment?.name;

  return <article tabIndex={-1} className={`message-row ${mine ? 'is-outgoing' : 'is-incoming'} ${groupedWithPrevious ? 'grouped' : ''} ${groupedWithNext ? 'continues' : ''}`} aria-label={mine ? 'Sent by you' : 'Received message'}>
    <div
      className={`message-bubble ${message.attachment ? 'with-media' : ''} ${emojiOnly ? 'is-emoji-only' : ''} ${swiping ? 'is-swiping' : ''} ${swipeOffset >= SWIPE_REPLY_THRESHOLD ? 'is-swipe-ready' : ''}`}
      style={swipeStyle}
      onPointerDown={beginSwipe}
      onPointerMove={moveSwipe}
      onPointerUp={event => finishSwipe(event)}
      onPointerCancel={event => finishSwipe(event, true)}
      onContextMenu={event => { if (window.matchMedia('(pointer: coarse)').matches) event.preventDefault(); }}
    >
      {!message.deleted && <span className="message-swipe-reply" aria-hidden="true"><Reply size={18} /></span>}
      {message.replyTo && !message.deleted && (onOpenReply ? <button type="button" className="reply-quote" onClick={onOpenReply} aria-label={`Go to the message from ${replyAuthor}`}><strong>{replyAuthor}</strong><span>{replyText}</span></button> : <div className="reply-quote"><strong>{replyAuthor}</strong><span>{replyText}</span></div>)}
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
