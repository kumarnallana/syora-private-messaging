'use client';
import { useState } from 'react';
import { AlertCircle, Check, CheckCheck, Clock3, Reply, Trash2, RotateCcw } from 'lucide-react';
import { time, IconButton, Modal } from '@/components/shared/ui';
import { AttachmentContent } from '@/components/media/attachment';
import { useApp } from '@/stores/use-app';
import type { Message } from '@/types';
const icons={sending:Clock3,sent:Check,delivered:CheckCheck,read:CheckCheck,failed:AlertCircle};
export function MessageBubble({message,mine,original,onReply}:{message:Message;mine:boolean;original?:Message;onReply:()=>void}) {
 const {services,users,me}=useApp();
 const [deleting,setDeleting]=useState(false);
 const [error,setError]=useState('');
 const [retrying,setRetrying]=useState(false);
 const ReceiptIcon=icons[message.receipt];
 function remove(everyone:boolean){try{services.deleteMessage(message.id,everyone);setDeleting(false);}catch(error){setError((error as Error).message)}}
 return <article className={`message-row ${mine?'outgoing':'incoming'}`} aria-label={mine?'Sent by you':'Received message'}>
  <div className={`message-bubble ${message.attachment?'with-media':''}`}>
   {message.replyTo&&!message.deleted&&<div className="reply-quote"><strong>{original?.senderId===me!.id?'You':users.find(u=>u.id===original?.senderId)?.name||'Original message'}</strong><span>{!original?'Message unavailable':original.deleted?'Message deleted':original.text||original.attachment?.name}</span></div>}
   {message.deleted?<p className="deleted-message"><Trash2 size={14}/> This message was deleted</p>:<>{message.attachment&&<AttachmentContent attachment={message.attachment}/>} {message.text&&<p>{message.text}</p>}</>}
   <div className="message-meta"><time dateTime={message.createdAt}>{time(message.createdAt)}</time>{mine&&!message.deleted&&<span className={`receipt ${message.receipt}`} aria-label={message.receipt} title={message.receipt}><ReceiptIcon size={14}/><span>{message.receipt}</span></span>}</div>
   {mine&&message.receipt==='failed'&&!message.deleted&&<button className="retry-button" disabled={retrying} onClick={async()=>{setRetrying(true);try{await services.retry(message.id)}catch(error){setError((error as Error).message)}finally{setRetrying(false)}}}><RotateCcw size={14}/> Retry message</button>}
   {error&&<p className="inline-error" role="alert">{error}</p>}
  </div><div className="message-actions">{!message.deleted&&<IconButton label="Reply to message" onClick={onReply}><Reply size={17}/></IconButton>}<IconButton label="Delete message" onClick={()=>setDeleting(true)}><Trash2 size={16}/></IconButton></div>
  {deleting&&<Modal title="Delete this message?" onClose={()=>setDeleting(false)}><p className="modal-copy">Delete for me hides it from your profile. Delete for everyone leaves a deleted-message notice.</p><div className="delete-choices"><button className="button secondary" onClick={()=>remove(false)}>Delete for me</button>{mine&&!message.deleted&&<button className="button danger" onClick={()=>remove(true)}>Delete for everyone</button>}<button className="button secondary" onClick={()=>setDeleting(false)}>Cancel</button></div></Modal>}
 </article>;
}
