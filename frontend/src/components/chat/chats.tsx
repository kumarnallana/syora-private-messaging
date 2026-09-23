'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowDown, ArrowLeft, Ban, BellOff, LoaderCircle, MessageCircle, MoreHorizontal, Pin, Search, SquarePen, X } from 'lucide-react';
import { useApp } from '@/stores/use-app';
import { Avatar, Brand, Empty, IconButton, Modal, time } from '@/components/shared/ui';
import { MessageBubble } from './message-bubble';
import { Composer } from './composer';
import { DeliveryReceipt } from './delivery-receipt';
import { formatLastSeen, normalizeUsername, usernameLabel } from '@/utils/presentation';
import { CHAT_WALLPAPER_EVENT, getChatWallpaper } from '@/utils/chat-wallpaper';
import type { Message } from '@/types';

const SEQUENCE_WINDOW_MS = 5 * 60 * 1000;
function belongsToSequence(previous?: Message, current?: Message) {
 return Boolean(previous && current && previous.senderId === current.senderId && new Date(previous.createdAt).toDateString() === new Date(current.createdAt).toDateString() && new Date(current.createdAt).getTime() - new Date(previous.createdAt).getTime() <= SEQUENCE_WINDOW_MS);
}

export function Chats() {
 const { me, users, conversations, messages, services, preferences } = useApp();
 const params = useSearchParams();
 const router = useRouter();
 const [selected, setSelected] = useState<string | null>(params.get('conversation'));
 const [query,setQuery]=useState('');
 const [messageQuery,setMessageQuery]=useState('');
 const [searchOpen,setSearchOpen]=useState(false);
 const [infoOpen,setInfoOpen]=useState(false);
 const [filter,setFilter]=useState<'all'|'unread'>('all');
 const [messageState,setMessageState]=useState<'idle'|'loading'|'loaded'|'error'>('idle');
 const [hasOlder,setHasOlder]=useState(true);
 const [loadingOlder,setLoadingOlder]=useState(false);
 const [detailBusy,setDetailBusy]=useState<string>();
 const [actionError,setActionError]=useState('');
 const [reply,setReply]=useState<import('@/types').Message>();
 const [wallpaper,setWallpaper]=useState('');
 const [showLatest,setShowLatest]=useState(false);
 const [latestCount,setLatestCount]=useState(0);
 const [unreadFrom,setUnreadFrom]=useState<string>();
 const timeline = useRef<HTMLDivElement>(null);
 const heading = useRef<HTMLHeadingElement>(null);
 const rowRefs = useRef(new Map<string, HTMLButtonElement>());
 const nearBottom = useRef(true);
 const active = conversations.find(c => c.id === selected && c.participants.includes(me!.id));
 const friend = users.find(u => active?.participants.includes(u.id) && u.id !== me?.id);
 const presence = friend ? formatLastSeen(friend.lastSeen, friend.online) || usernameLabel(friend.username) : '';
 const messagesByConversation = useMemo(() => {
  const grouped = new Map<string, Message[]>();
  for (const message of messages) {
   const group = grouped.get(message.conversationId);
   if (group) group.push(message); else grouped.set(message.conversationId, [message]);
  }
  return grouped;
 }, [messages]);
 const activeMessages = active ? messagesByConversation.get(active.id) || [] : [];
 const normalizedMessageQuery = messageQuery.trim().toLowerCase();
 const visibleMessages = useMemo(() => activeMessages.filter(message => !normalizedMessageQuery || message.text.toLowerCase().includes(normalizedMessageQuery) || message.attachment?.name.toLowerCase().includes(normalizedMessageQuery)), [activeMessages, normalizedMessageQuery]);
 const ordered = useMemo(() => [...conversations].sort((a, b) => (messagesByConversation.get(b.id)?.at(-1)?.createdAt || '').localeCompare(messagesByConversation.get(a.id)?.at(-1)?.createdAt || '')), [conversations, messagesByConversation]);
 const messageById = useMemo(() => new Map(messages.map(message => [message.id, message])), [messages]);
 const latestMessage = activeMessages.at(-1);
 useEffect(() => { setSelected(params.get('conversation')); }, [params]);
 useEffect(() => { window.dispatchEvent(new Event('syora:navigation')); }, [selected]);
 useEffect(() => {
  const syncWallpaper = () => setWallpaper(getChatWallpaper());
  syncWallpaper();
  window.addEventListener('storage', syncWallpaper);
  window.addEventListener(CHAT_WALLPAPER_EVENT, syncWallpaper);
  return () => { window.removeEventListener('storage', syncWallpaper); window.removeEventListener(CHAT_WALLPAPER_EVENT, syncWallpaper); };
 }, []);
 useEffect(() => {
  if (!active) return;
  let current=true;setMessageState('loading');setActionError('');setHasOlder(true);
  void services.loadMessages(active.id).then(more=>{if(current){setHasOlder(more);setMessageState('loaded')}}).catch(error=>{if(current){setMessageState('error');setActionError(error instanceof Error?error.message:'Messages could not be loaded.')}});
  setReply(undefined);setMessageQuery('');setSearchOpen(false);
  nearBottom.current = true;
  setShowLatest(false);
  setLatestCount(0);
  setUnreadFrom(undefined);
  heading.current?.focus({ preventScroll: true });
  return()=>{current=false};
 }, [active?.id, me?.id, services]);
 useEffect(() => {
  if (nearBottom.current || latestMessage?.senderId === me?.id) {
   timeline.current?.scrollTo({ top: timeline.current.scrollHeight });
   setShowLatest(false);
   setLatestCount(0);
  } else if (latestMessage) {
   setShowLatest(true);
   setLatestCount(count => count + 1);
  }
 }, [active?.id, latestMessage?.id, me?.id]);
 useEffect(() => {
  if (!active || messageState !== 'loaded' || unreadFrom || active.unread <= 0) return;
  const incoming = activeMessages.filter(message => message.senderId !== me?.id && !message.deleted).slice(-active.unread);
  setUnreadFrom(incoming[0]?.id);
 }, [active?.id, messageState]);
 useEffect(() => {
  const element = timeline.current;
  const composer = element?.parentElement?.querySelector<HTMLElement>('.composer-wrap');
  if (!element || !composer || typeof ResizeObserver === 'undefined') return;
  let previousHeight = composer.getBoundingClientRect().height;
  const observer = new ResizeObserver(entries => {
   const nextHeight = entries[0]?.contentRect.height || previousHeight;
   if (nearBottom.current && Math.abs(nextHeight - previousHeight) > 1) requestAnimationFrame(() => element.scrollTo({ top: element.scrollHeight }));
   previousHeight = nextHeight;
  });
  observer.observe(composer);
  return () => observer.disconnect();
 }, [active?.id]);
 useEffect(() => {
  if (!active || messageState !== 'loaded' || active.unread <= 0) return;
  const markVisible = () => {
   if (document.visibilityState === 'visible' && document.hasFocus()) services.markRead(active.id);
  };
  markVisible();
  document.addEventListener('visibilitychange', markVisible);
  window.addEventListener('focus', markVisible);
  return () => { document.removeEventListener('visibilitychange', markVisible); window.removeEventListener('focus', markVisible); };
 },[active?.id,active?.unread,messageState,services]);
 function back() {
  const id = selected;
  router.back();
  requestAnimationFrame(() => { if (id) rowRefs.current.get(id)?.focus(); });
 }
 function selectConversation(id: string) {
  setSelected(id);
  router.push('/chats?conversation=' + encodeURIComponent(id));
 }
 async function loadEarlier() {
  if (!active || loadingOlder) return;
  setLoadingOlder(true); setActionError('');
  const element = timeline.current;
  const previousHeight = element?.scrollHeight || 0;
  const previousTop = element?.scrollTop || 0;
  try {
   setHasOlder(await services.loadOlderMessages(active.id));
   requestAnimationFrame(() => {
    if (element) element.scrollTop = previousTop + element.scrollHeight - previousHeight;
   });
  }
  catch (error) { setActionError(error instanceof Error ? error.message : 'Earlier messages could not be loaded.'); }
  finally { setLoadingOlder(false); }
 }
 async function updateDetail(key: 'pinned' | 'muted' | 'blocked', work: () => Promise<void>) {
  if (detailBusy) return;
  setDetailBusy(key); setActionError('');
  try { await work(); }
  catch (error) { setActionError(error instanceof Error ? error.message : 'The conversation setting could not be updated.'); }
  finally { setDetailBusy(undefined); }
 }
 return <div className={`chat-layout ${active && friend ? 'has-conversation' : ''}`}>
  <section className="conversation-panel" aria-label="Conversations">
   <header className="list-header"><Brand/><div className="list-title"><h1>Messages <span className="count">{conversations.length}</span></h1><Link href="/contacts" className="icon-button" aria-label="New conversation" title="New conversation"><SquarePen size={18}/></Link></div><label className="search-field"><Search size={18}/><input aria-label="Search conversations" placeholder="Search conversations" value={query} autoComplete="off" spellCheck={false} onChange={e=>setQuery(e.target.value)}/>{query&&<IconButton label="Clear search" onClick={()=>setQuery('')}><X size={15}/></IconButton>}</label><div className="chat-filters" role="group" aria-label="Conversation filters"><button className={filter==='all'?'is-active':''} aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>All</button><button className={filter==='unread'?'is-active':''} aria-pressed={filter==='unread'} onClick={()=>setFilter('unread')}>Unread</button></div></header>
   <div className="conversation-rows">
    {ordered.map(conversation => {
     const person = users.find(u => conversation.participants.includes(u.id) && u.id !== me!.id);
     if (!person||filter==='unread'&&!conversation.unread||!(person.name.toLowerCase().includes(query.toLowerCase())||normalizeUsername(person.username).includes(normalizeUsername(query)))) return null;
     const last = messagesByConversation.get(conversation.id)?.at(-1);
     return <button key={conversation.id} ref={node => { if (node) rowRefs.current.set(conversation.id, node); else rowRefs.current.delete(conversation.id); }}
      className={`conversation-row ${active?.id === conversation.id ? 'is-selected' : ''} ${conversation.unread?'is-unread':''}`}
      aria-label={`Open conversation with ${person.name}${conversation.unread ? `, ${conversation.unread} unread` : ''}`}
      aria-current={active?.id === conversation.id ? 'true' : undefined} onClick={() => selectConversation(conversation.id)}>
      <Avatar user={person}/><span className="conversation-copy">
       <span className="conversation-top"><strong>{person.name}</strong>{last && <time dateTime={last.createdAt}>{time(last.createdAt)}</time>}</span>
       <span className="conversation-bottom"><span className={conversation.typing?'typing-text':''}>{conversation.typing?'typing…':last ? `${last.senderId === me!.id ? 'You: ' : ''}${last.deleted?'Message deleted':last.text||last.attachment?.name||'Attachment'}` : 'No messages yet'}</span><span className="row-indicators">{last?.senderId===me!.id&&!last.deleted&&<DeliveryReceipt state={last.receipt}/>} {conversation.muted&&<BellOff size={13}/>} {conversation.pinned&&<Pin size={13}/>} {conversation.unread > 0 && <span className="unread-badge">{conversation.unread}</span>}</span></span>
      </span>
     </button>;
    })}
    {!conversations.length?<Empty title="Your inbox is quiet" description="Find someone in your circle and start a private conversation."><Link className="button primary" href="/contacts">Find people</Link></Empty>:!ordered.some(c=>{const person=users.find(u=>c.participants.includes(u.id)&&u.id!==me!.id);return person&&(filter==='all'||c.unread>0)&&(person.name.toLowerCase().includes(query.toLowerCase())||normalizeUsername(person.username).includes(normalizeUsername(query)))})&&<Empty title={filter==='unread'?'You are all caught up':'No conversations found'} description={filter==='unread'?'There are no unread conversations.':'Try another name or username.'}/>}
   </div>
  </section>
  {active && friend ? <section className={`chat-panel has-chat-wallpaper ${wallpaper ? 'has-custom-wallpaper' : ''}`} style={wallpaper ? { backgroundImage: `linear-gradient(#090a0fba, #090a0fba), url("${wallpaper}")` } : undefined} aria-label={`Conversation with ${friend.name}`}>
   <header className="chat-header"><IconButton label="Back to conversations" className="mobile-back" onClick={back}><ArrowLeft size={21}/></IconButton>
    <Avatar user={friend} size="small"/><div className="chat-person"><h2 ref={heading} tabIndex={-1}>{friend.name}</h2><p>{active.typing ? 'typing…' : presence}</p></div><div className="chat-header-actions"><IconButton label="Search messages" onClick={()=>setSearchOpen(v=>!v)}><Search size={19}/></IconButton><IconButton label="Conversation options" onClick={()=>setInfoOpen(true)}><MoreHorizontal size={21}/></IconButton></div>
   </header>
   {searchOpen&&<div className="message-search"><label className="search-field"><Search size={17}/><input autoFocus aria-label="Search messages" placeholder="Search loaded messages" value={messageQuery} autoComplete="off" spellCheck={false} onChange={e=>setMessageQuery(e.target.value)}/></label><span>{visibleMessages.length} loaded results</span><IconButton label="Close message search" onClick={()=>{setSearchOpen(false);setMessageQuery('')}}><X size={18}/></IconButton></div>}
   <div className="timeline" ref={timeline} role="log" aria-label="Messages" aria-live="polite" aria-relevant="additions text" onScroll={e => { const el = e.currentTarget; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96; if (nearBottom.current) setShowLatest(false); }}><div className="timeline-feed">
    {messageState==='loading'&&<div className="timeline-state" role="status">Loading messages…</div>}
    {messageState==='error'&&<div className="timeline-state"><p>{actionError}</p><button className="button secondary small" onClick={()=>{setMessageState('loading');void services.loadMessages(active.id).then(more=>{setHasOlder(more);setMessageState('loaded')}).catch(error=>{setActionError((error as Error).message);setMessageState('error')})}}>Retry</button></div>}
    {messageState==='loaded'&&activeMessages.length>0&&hasOlder&&<button className="load-older" disabled={loadingOlder} onClick={()=>void loadEarlier()}>{loadingOlder && <LoaderCircle className="spin" size={15}/>} {loadingOlder ? 'Loading…' : 'Load earlier messages'}</button>}
    {visibleMessages.map((message, index) => {
     const day = new Date(message.createdAt).toDateString();
     const previous = visibleMessages[index - 1];
     const next = visibleMessages[index + 1];
     return <div key={message.id}>
      {(!previous || new Date(previous.createdAt).toDateString() !== day) && <div className="date-separator">{day === new Date().toDateString() ? 'Today' : new Date(message.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</div>}
      {!messageQuery && message.id === unreadFrom && <div className="unread-separator"><span>Unread messages</span></div>}
      <MessageBubble message={message} mine={message.senderId === me!.id} groupedWithPrevious={belongsToSequence(previous,message)} groupedWithNext={belongsToSequence(message,next)} original={(message.replyTo&&messageById.get(message.replyTo))||message.replyPreview} onReply={()=>setReply(message)}/>
     </div>;
    })}
    {messageState==='loaded'&&!visibleMessages.length && <Empty title={messageQuery?'No messages found':'Start with a hello'} description={messageQuery?'Try another word or file name.':`Send the first message to ${friend.name.split(' ')[0]}.`}/>}</div>
   </div>
   {showLatest&&<button type="button" className="jump-to-latest" aria-label={latestCount ? 'Jump to '+latestCount+' new message'+(latestCount === 1 ? '' : 's') : 'Jump to latest messages'} onClick={()=>{timeline.current?.scrollTo({top:timeline.current.scrollHeight,behavior:'smooth'});nearBottom.current=true;setShowLatest(false);setLatestCount(0)}}><ArrowDown size={16}/><span>Latest messages</span>{latestCount>0&&<strong>{latestCount>99?'99+':latestCount}</strong>}</button>}
   <Composer key={`${me!.id}:${active.id}`} conversationId={active.id} blocked={preferences.blocked.includes(friend.id)} reply={reply} clearReply={()=>setReply(undefined)}/>
   {infoOpen&&<Modal title="Conversation details" className="mobile-sheet conversation-detail-dialog" onClose={()=>setInfoOpen(false)}><div className="person-detail"><Avatar user={friend} size="large"/><h2>{friend.name}</h2><strong className="username">{usernameLabel(friend.username)}</strong><p>{friend.about}</p></div>{actionError&&<p className="inline-error" role="alert">{actionError}</p>}<div className="detail-actions" aria-busy={Boolean(detailBusy)}><button disabled={Boolean(detailBusy)} onClick={()=>void updateDetail('pinned',()=>services.toggleConversation(active.id,'pinned'))}>{detailBusy==='pinned'?<LoaderCircle className="spin" size={18}/>:<Pin size={18}/>}<span>{active.pinned?'Unpin conversation':'Pin conversation'}</span></button><button disabled={Boolean(detailBusy)} onClick={()=>void updateDetail('muted',()=>services.toggleConversation(active.id,'muted'))}>{detailBusy==='muted'?<LoaderCircle className="spin" size={18}/>:<BellOff size={18}/>}<span>{active.muted?'Unmute notifications':'Mute notifications'}</span></button><button className="danger-text" disabled={Boolean(detailBusy)} onClick={()=>void updateDetail('blocked',()=>services.block(friend.id))}>{detailBusy==='blocked'?<LoaderCircle className="spin" size={18}/>:<Ban size={18}/>}<span>{preferences.blocked.includes(friend.id)?'Unblock contact':'Block contact'}</span></button></div></Modal>}
  </section> : <section className="chat-panel welcome-panel"><MessageCircle size={40}/><h2>{conversations.length ? 'A space for your conversations' : 'Your private conversations live here'}</h2><p>{conversations.length ? 'Choose someone from your messages to catch up.' : 'Use the new conversation button when you are ready to begin.'}</p></section>}
 </div>;
}
