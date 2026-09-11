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
 useEffect(()=>()=>{if(pending.current)URL.revokeObjectURL(pending.current.url)},[]);
 function choose(file?:Attachment){if(pending.current)URL.revokeObjectURL(pending.current.url);pending.current=file;setAttachment(file);}
 async function send(){
  if((!text.trim()&&!attachment)||blocked||submitting.current)return;
  submitting.current=true;setBusy(true);setError('');
  try{await services.send(conversationId,text,attachment,reply?.id);pending.current=undefined;setAttachment(undefined);setText('');clearReply();setEmoji(false);if(input.current)input.current.style.height='auto';}
  catch(error){setError(error instanceof Error?error.message:'Message could not be sent. Please try again.');}
  finally{submitting.current=false;setBusy(false);input.current?.focus();}
 }
 return <div className="composer-wrap" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(blocked||busy)return;try{const file=e.dataTransfer.files[0];if(file)choose(pickAttachment(file));}catch(error){setError((error as Error).message)}}}>
  {error&&<p className="inline-error" role="alert">{error}</p>}
  {reply&&<div className="composer-reply"><Reply size={18}/><span><strong>Replying to {users.find(u=>u.id===reply.senderId)?.name}</strong><small>{reply.deleted?'Message deleted':reply.text||reply.attachment?.name}</small></span><IconButton label="Cancel reply" onClick={clearReply}><X size={18}/></IconButton></div>}
  {emoji&&<div className="emoji-picker" role="group" aria-label="Emoji picker"><header>Choose an emoji<IconButton label="Close emoji picker" onClick={()=>setEmoji(false)}><X size={17}/></IconButton></header><div>{emojis.map(e=><button type="button" key={e} aria-label={`Insert ${e}`} onClick={()=>{setText(t=>(t+e).slice(0,10000));input.current?.focus()}}>{e}</button>)}</div></div>}
  <form onSubmit={e=>{e.preventDefault();void send()}}><div className="composer">
   <FilePicker onSelect={choose} onError={setError} disabled={blocked||busy}/>
   <textarea ref={input} rows={1} aria-label="Message" placeholder={blocked?'This contact is blocked':'Write a message…'} value={text} readOnly={busy} disabled={blocked} maxLength={10000} onChange={e=>{setText(e.target.value);e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,140)+'px'}} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send()}if(e.key==='Escape')setEmoji(false)}}/>
   <IconButton label="Choose emoji" disabled={blocked||busy} onClick={()=>setEmoji(!emoji)}><Smile size={21}/></IconButton>
   <button type="submit" className="icon-button send-button" aria-label="Send message" disabled={blocked||busy||(!text.trim()&&!attachment)}><Send size={20}/></button>
  </div></form><p className="composer-hint">Enter to send · Shift + Enter for a new line</p>
  {attachment&&<Modal title="Ready to share?" className="mobile-sheet" onClose={()=>{if(!busy)choose(undefined)}}><AttachmentContent attachment={attachment} preview/><label className="field">Caption<textarea aria-label="Attachment caption" value={text} onChange={e=>setText(e.target.value)} maxLength={10000} readOnly={busy}/></label><p className="demo-disclosure">Local preview only. No file is uploaded.</p><div className="modal-actions"><button className="button secondary" disabled={busy} onClick={()=>choose(undefined)}>Cancel</button><button className="button primary" disabled={busy||blocked} onClick={()=>void send()}>{busy?'Sending…':'Send attachment'}</button></div></Modal>}
 </div>;
}
