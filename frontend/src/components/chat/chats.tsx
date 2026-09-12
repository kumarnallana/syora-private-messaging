'use client';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Ban, BellOff, MessageCircle, MoreHorizontal, Pin, Search, SquarePen, X } from 'lucide-react';
import { useApp } from '@/stores/use-app';
import { Avatar, Brand, Empty, IconButton, Modal, time } from '@/components/shared/ui';
import { PreviewNote } from '@/components/shell';
import { MessageBubble } from './message-bubble';
import { Composer } from './composer';
import { DeliveryReceipt } from './delivery-receipt';

export function Chats() {
 const { me, users, conversations, messages, services, preferences } = useApp();
 const params = useSearchParams();
 const [selected, setSelected] = useState<string | null>(params.get('conversation'));
 const [query,setQuery]=useState('');
 const [messageQuery,setMessageQuery]=useState('');
 const [searchOpen,setSearchOpen]=useState(false);
 const [infoOpen,setInfoOpen]=useState(false);
 const [filter,setFilter]=useState<'all'|'unread'>('all');
 const [messageState,setMessageState]=useState<'idle'|'loading'|'loaded'|'error'>('idle');
 const [hasOlder,setHasOlder]=useState(true);
 const [actionError,setActionError]=useState('');
 const [reply,setReply]=useState<import('@/types').Message>();
 const timeline = useRef<HTMLDivElement>(null);
 const heading = useRef<HTMLHeadingElement>(null);
 const rowRefs = useRef(new Map<string, HTMLButtonElement>());
 const nearBottom = useRef(true);
 const active = conversations.find(c => c.id === selected && c.participants.includes(me!.id));
 const friend = users.find(u => active?.participants.includes(u.id) && u.id !== me?.id);
 const activeMessages = messages.filter(m => m.conversationId === active?.id);
 const visibleMessages=activeMessages.filter(m=>!messageQuery||m.text.toLowerCase().includes(messageQuery.toLowerCase())||m.attachment?.name.toLowerCase().includes(messageQuery.toLowerCase()));
 const ordered = [...conversations].sort((a, b) => {
  const latest = (id: string) => messages.filter(m => m.conversationId === id).at(-1)?.createdAt || '';
  return latest(b.id).localeCompare(latest(a.id));
 });
 useEffect(() => { setSelected(params.get('conversation')); }, [params]);
 useEffect(() => {
  if (!active) return;
  let current=true;setMessageState('loading');setActionError('');setHasOlder(true);
  void services.loadMessages(active.id).then(more=>{if(current){setHasOlder(more);setMessageState('loaded')}}).catch(error=>{if(current){setMessageState('error');setActionError(error instanceof Error?error.message:'Messages could not be loaded.')}});
  setReply(undefined);setMessageQuery('');setSearchOpen(false);
  nearBottom.current = true;
  heading.current?.focus({ preventScroll: true });
  return()=>{current=false};
 }, [active?.id, me?.id, services]);
 useEffect(() => {
  const last = activeMessages.at(-1);
  if (nearBottom.current || last?.senderId === me?.id) timeline.current?.scrollTo({ top: timeline.current.scrollHeight });
 }, [active?.id, activeMessages.length, me?.id]);
 useEffect(() => {
  if(active&&messageState==='loaded'&&active.unread>0)services.markRead(active.id);
 },[active?.id,active?.unread,messageState,services]);
 function back() {
  const id = selected;
  setSelected(null);
  requestAnimationFrame(() => { if (id) rowRefs.current.get(id)?.focus(); });
 }
 return <div className={`chat-layout ${active && friend ? 'has-conversation' : ''}`}>
  <section className="conversation-panel" aria-label="Conversations">
   <header className="list-header"><Brand/><div className="list-title"><h1>Messages <span className="count">{conversations.length}</span></h1><Link href="/contacts" className="icon-button" aria-label="New conversation" title="New conversation"><SquarePen size={18}/></Link></div><label className="search-field"><Search size={18}/><input aria-label="Search conversations" placeholder="Search conversations" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<IconButton label="Clear search" onClick={()=>setQuery('')}><X size={15}/></IconButton>}</label><div className="chat-filters" role="group" aria-label="Conversation filters"><button className={filter==='all'?'is-active':''} aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>All</button><button className={filter==='unread'?'is-active':''} aria-pressed={filter==='unread'} onClick={()=>setFilter('unread')}>Unread</button></div></header>
   <div className="conversation-rows">
    {ordered.map(conversation => {
     const person = users.find(u => conversation.participants.includes(u.id) && u.id !== me!.id);
     if (!person||filter==='unread'&&!conversation.unread||!(person.name.toLowerCase().includes(query.toLowerCase())||person.username.toLowerCase().includes(query.toLowerCase().replace(/^@/,'')))) return null;
     const last = messages.filter(m => m.conversationId === conversation.id).at(-1);
     return <button key={conversation.id} ref={node => { if (node) rowRefs.current.set(conversation.id, node); else rowRefs.current.delete(conversation.id); }}
      className={`conversation-row ${active?.id === conversation.id ? 'is-selected' : ''} ${conversation.unread?'is-unread':''}`}
      aria-label={`Open conversation with ${person.name}${conversation.unread ? `, ${conversation.unread} unread` : ''}`}
      aria-current={active?.id === conversation.id ? 'true' : undefined} onClick={() => setSelected(conversation.id)}>
      <Avatar user={person}/><span className="conversation-copy">
       <span className="conversation-top"><strong>{person.name}</strong>{last && <time dateTime={last.createdAt}>{time(last.createdAt)}</time>}</span>
       <span className="conversation-bottom"><span className={conversation.typing?'typing-text':''}>{conversation.typing?'typing…':last ? `${last.senderId === me!.id ? 'You: ' : ''}${last.deleted?'Message deleted':last.text||last.attachment?.name||'Attachment'}` : 'No messages yet'}</span><span className="row-indicators">{last?.senderId===me!.id&&!last.deleted&&<DeliveryReceipt state={last.receipt}/>} {conversation.muted&&<BellOff size={13}/>} {conversation.pinned&&<Pin size={13}/>} {conversation.unread > 0 && <span className="unread-badge">{conversation.unread}</span>}</span></span>
      </span>
     </button>;
    })}
    {!conversations.length?<Empty title="Your inbox is quiet" description="Find someone in your circle and start a private conversation."><Link className="button primary" href="/contacts">Find people</Link></Empty>:!ordered.some(c=>{const person=users.find(u=>c.participants.includes(u.id)&&u.id!==me!.id);return person&&(filter==='all'||c.unread>0)&&(person.name.toLowerCase().includes(query.toLowerCase())||person.username.includes(query.toLowerCase().replace(/^@/,'')))})&&<Empty title={filter==='unread'?'You are all caught up':'No conversations found'} description={filter==='unread'?'There are no unread conversations.':'Try another name or username.'}/>}
   </div><footer className="list-footer"><PreviewNote/></footer>
  </section>
  {active && friend ? <section className="chat-panel" aria-label={`Conversation with ${friend.name}`}>
   <header className="chat-header"><IconButton label="Back to conversations" className="mobile-back" onClick={back}><ArrowLeft size={21}/></IconButton>
    <Avatar user={friend} size="small"/><div className="chat-person"><h2 ref={heading} tabIndex={-1}>{friend.name}</h2><p>{active.typing?'typing…':friend.online ? 'Online' : friend.lastSeen ? `Last seen ${friend.lastSeen}` : `@${friend.username}`}</p></div><div className="chat-header-actions"><IconButton label="Search messages" onClick={()=>setSearchOpen(v=>!v)}><Search size={19}/></IconButton><IconButton label="Conversation options" onClick={()=>setInfoOpen(true)}><MoreHorizontal size={21}/></IconButton></div>
   </header>
   {searchOpen&&<div className="message-search"><label className="search-field"><Search size={17}/><input autoFocus aria-label="Search messages" placeholder="Search this conversation" value={messageQuery} onChange={e=>setMessageQuery(e.target.value)}/></label><span>{visibleMessages.length} results</span><IconButton label="Close message search" onClick={()=>{setSearchOpen(false);setMessageQuery('')}}><X size={18}/></IconButton></div>}
   <div className="timeline" ref={timeline} role="log" aria-label="Messages" aria-live="polite" aria-relevant="additions text" onScroll={e => { const el = e.currentTarget; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}><div className="timeline-feed">
    {messageState==='loading'&&<div className="timeline-state" role="status">Loading messages…</div>}
    {messageState==='error'&&<div className="timeline-state"><p>{actionError}</p><button className="button secondary small" onClick={()=>{setMessageState('loading');void services.loadMessages(active.id).then(more=>{setHasOlder(more);setMessageState('loaded')}).catch(error=>{setActionError((error as Error).message);setMessageState('error')})}}>Retry</button></div>}
    {messageState==='loaded'&&activeMessages.length>0&&hasOlder&&<button className="load-older" onClick={()=>void services.loadOlderMessages(active.id).then(setHasOlder).catch(error=>setActionError((error as Error).message))}>Load earlier messages</button>}
    {visibleMessages.map((message, index) => {
     const day = new Date(message.createdAt).toDateString();
     const previous = visibleMessages[index - 1];
     return <div key={message.id}>
      {(!previous || new Date(previous.createdAt).toDateString() !== day) && <div className="date-separator">{day === new Date().toDateString() ? 'Today' : new Date(message.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</div>}
      <MessageBubble message={message} mine={message.senderId === me!.id} groupedWithPrevious={!!previous&&previous.senderId===message.senderId&&new Date(previous.createdAt).toDateString()===day} original={activeMessages.find(m=>m.id===message.replyTo)||message.replyPreview} onReply={()=>setReply(message)}/>
     </div>;
    })}
    {messageState==='loaded'&&!visibleMessages.length && <Empty title={messageQuery?'No messages found':'Start with a hello'} description={messageQuery?'Try another word or file name.':`Send the first message to ${friend.name.split(' ')[0]}.`}/>}</div>
   </div>
   <Composer key={`${me!.id}:${active.id}`} conversationId={active.id} blocked={preferences.blocked.includes(friend.id)} reply={reply} clearReply={()=>setReply(undefined)}/>
   {infoOpen&&<Modal title="Conversation details" className="mobile-sheet" onClose={()=>setInfoOpen(false)}><div className="person-detail"><Avatar user={friend} size="large"/><h2>{friend.name}</h2><strong className="username">@{friend.username}</strong><p>{friend.about}</p>{friend.email&&<small>{friend.email}</small>}</div>{actionError&&<p className="inline-error" role="alert">{actionError}</p>}<div className="detail-actions"><button onClick={()=>void services.toggleConversation(active.id,'pinned').catch(e=>setActionError((e as Error).message))}><Pin size={18}/>{active.pinned?'Unpin conversation':'Pin conversation'}</button><button onClick={()=>void services.toggleConversation(active.id,'muted').catch(e=>setActionError((e as Error).message))}><BellOff size={18}/>{active.muted?'Unmute notifications':'Mute notifications'}</button><button onClick={()=>void services.block(friend.id).catch(e=>setActionError((e as Error).message))}><Ban size={18}/>{preferences.blocked.includes(friend.id)?'Unblock contact':'Block contact'}</button></div></Modal>}
  </section> : <section className="chat-panel welcome-panel"><MessageCircle size={40}/><h2>{conversations.length ? 'A space for your conversations' : 'No conversations yet'}</h2><p>{conversations.length ? 'Choose someone from your messages to catch up.' : 'Find someone in your circle to begin.'}</p>{!conversations.length&&<Link className="button primary" href="/contacts">Find people</Link>}</section>}
 </div>;
}
