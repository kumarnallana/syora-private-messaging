'use client';
import { useEffect, useRef, useState } from 'react';
import { Send, Smile, X, Reply } from 'lucide-react';
import { useApp } from '@/stores/use-app';
import { IconButton, Modal, pickAttachment } from '@/components/shared/ui';
import { FilePicker, AttachmentContent } from '@/components/media/attachment';
import type { Attachment, Message } from '@/types';
const emojis=['😊','❤️','😂','✨','🙌','👍','☕','🎉','🌿','👋','🔥','💜','🥰','🤔','😎','🌅','🙏','💯','🎧','🌻','🤍','👀','🚀','☀️'];
export function Composer({conversationId,blocked,reply,clearReply}:{conversationId:string;blocked:boolean;reply?:Message;clearReply:()=>void}) {
 const {services,users}=useApp();
 const [text,setText]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [emoji,setEmoji]=useState(false);
 const [attachment,setAttachment]=useState<Attachment>();
 const pending=useRef<Attachment|undefined>(undefined);
 const input=useRef<HTMLTextAreaElement>(null);
 const submitting=useRef(false);
 const typingTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 useEffect(()=>()=>{if(pending.current)URL.revokeObjectURL(pending.current.url)},[]);
 useEffect(()=>()=>{if(typingTimer.current)clearTimeout(typingTimer.current);services.typing(conversationId,false)},[conversationId,services]);
 function choose(file?:Attachment){if(pending.current)URL.revokeObjectURL(pending.current.url);pending.current=file;setAttachment(file);}
 async function send(){
  if((!text.trim()&&!attachment)||blocked||submitting.current)return;
  submitting.current=true;setBusy(true);setError('');
  const outgoingText=text;
  const outgoingAttachment=attachment;
  const outgoingReply=reply?.id;
  services.typing(conversationId,false);setAttachment(undefined);setText('');clearReply();setEmoji(false);if(input.current)input.current.style.height='auto';
  const request=services.send(conversationId,outgoingText,outgoingAttachment,outgoingReply);
  if(!outgoingAttachment){submitting.current=false;setBusy(false);input.current?.focus();}
  try{await request;if(pending.current?.url.startsWith('blob:'))URL.revokeObjectURL(pending.current.url);pending.current=undefined;}
  catch(error){setError(error instanceof Error?error.message:'Message could not be sent. Please try again.');}
  finally{if(outgoingAttachment){submitting.current=false;setBusy(false);input.current?.focus();}}
 }
 return <div className="composer-wrap" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(blocked||busy)return;try{const file=e.dataTransfer.files[0];if(file)choose(pickAttachment(file));}catch(error){setError((error as Error).message)}}}>
  {error&&<p className="inline-error" role="alert">{error}</p>}
  {reply&&<div className="composer-reply"><Reply size={18}/><span><strong>Replying to {users.find(u=>u.id===reply.senderId)?.name}</strong><small>{reply.deleted?'Message deleted':reply.text||reply.attachment?.name}</small></span><IconButton label="Cancel reply" onClick={clearReply}><X size={18}/></IconButton></div>}
  {emoji&&<div className="emoji-picker" role="group" aria-label="Emoji picker"><header>Choose an emoji<IconButton label="Close emoji picker" onClick={()=>setEmoji(false)}><X size={17}/></IconButton></header><div>{emojis.map(e=><button type="button" key={e} aria-label={`Insert ${e}`} onClick={()=>{setText(t=>(t+e).slice(0,10000));input.current?.focus()}}>{e}</button>)}</div></div>}
  <form onSubmit={e=>{e.preventDefault();void send()}}><div className="composer">
   <FilePicker onSelect={choose} onError={setError} disabled={blocked||busy}/>
   <textarea ref={input} rows={1} aria-label="Message" placeholder={blocked?'This contact is blocked':'Write a message…'} value={text} readOnly={busy} disabled={blocked} maxLength={10000} onChange={e=>{setText(e.target.value);services.typing(conversationId,true);if(typingTimer.current)clearTimeout(typingTimer.current);typingTimer.current=setTimeout(()=>services.typing(conversationId,false),1200);e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,140)+'px'}} onBlur={()=>services.typing(conversationId,false)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send()}if(e.key==='Escape')setEmoji(false)}}/>
   <IconButton label="Choose emoji" disabled={blocked||busy} onClick={()=>setEmoji(!emoji)}><Smile size={21}/></IconButton>
   <button type="submit" className="icon-button send-button" aria-label="Send message" disabled={blocked||busy||(!text.trim()&&!attachment)}><Send size={20}/></button>
  </div></form>
  {attachment&&<Modal title="Ready to share?" className="mobile-sheet" onClose={()=>{if(!busy)choose(undefined)}}><AttachmentContent attachment={attachment} preview/><label className="field">Caption<textarea aria-label="Attachment caption" value={text} onChange={e=>setText(e.target.value)} maxLength={10000} readOnly={busy}/></label><p className="demo-disclosure">The file will be shared privately in this conversation.</p><div className="modal-actions"><button className="button secondary" disabled={busy} onClick={()=>choose(undefined)}>Cancel</button><button className="button primary" disabled={busy||blocked} onClick={()=>void send()}>{busy?'Sending…':'Send attachment'}</button></div></Modal>}
 </div>;
}
