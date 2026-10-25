'use client';
import { useEffect, useRef, useState } from 'react';
import { Send, Smile, X, Reply, Sparkles, Wand2 } from 'lucide-react';
import { useApp } from '@/stores/use-app';
import { IconButton, Modal, pickAttachment } from '@/components/shared/ui';
import { FilePicker, AttachmentContent } from '@/components/media/attachment';
import type { Attachment, Message } from '@/types';

const emojis = ['😊','❤️','😂','✨','🙌','👍','☕','🎉','🌿','👋','🔥','💜','🥰','🤔','😎','🌅','🙏','💯','🎧','🌻','🤍','👀','🚀','☀️'];

export function Composer({conversationId,blocked,reply,clearReply}:{conversationId:string;blocked:boolean;reply?:Message;clearReply:()=>void}) {
 const {services,users}=useApp();
 const [text,setText]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [emoji,setEmoji]=useState(false);
 const [aiOpen,setAiOpen]=useState(false);
 const [aiBusy,setAiBusy]=useState(false);
 const [attachment,setAttachment]=useState<Attachment>();
 const pending=useRef<Attachment|undefined>(undefined);
 const input=useRef<HTMLTextAreaElement>(null);
 const submitting=useRef(false);
 const typingTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);

 useEffect(()=>()=>{if(pending.current)URL.revokeObjectURL(pending.current.url)},[]);
 useEffect(()=>()=>{if(typingTimer.current)clearTimeout(typingTimer.current);services.typing(conversationId,false)},[conversationId,services]);
 useEffect(()=>{if(reply&&!blocked)input.current?.focus()},[reply,blocked]);

 function choose(file?:Attachment){if(pending.current)URL.revokeObjectURL(pending.current.url);pending.current=file;setAttachment(file);}

 async function send(){
  if((!text.trim()&&!attachment)||blocked||submitting.current)return;
  submitting.current=true;setBusy(true);setError('');
  const outgoingText=text;
  const outgoingAttachment=attachment;
  const outgoingReply=reply?.id;
  services.typing(conversationId,false);setAttachment(undefined);setText('');clearReply();setEmoji(false);setAiOpen(false);
  const request=services.send(conversationId,outgoingText,outgoingAttachment,outgoingReply);
  if(!outgoingAttachment){submitting.current=false;setBusy(false);input.current?.focus();}
  try{await request;if(pending.current?.url.startsWith('blob:'))URL.revokeObjectURL(pending.current.url);pending.current=undefined;}
  catch(error){setError(error instanceof Error?error.message:'Message could not be sent. Please try again.');}
  finally{if(outgoingAttachment){submitting.current=false;setBusy(false);input.current?.focus();}}
 }

 async function handleRefineTone(tone: 'polish' | 'professional' | 'concise' | 'friendly') {
  if (!text.trim() || aiBusy) return;
  setAiBusy(true);
  try {
   const { callGeminiAPI } = await import('@/services/ai-engine');
   const promptMap = {
    polish: `Polish this draft for maximum clarity, natural flow, and impeccable grammar: "${text}"`,
    professional: `Rewrite this message in an articulate, highly professional, respectful workplace tone: "${text}"`,
    concise: `Make this message crisp, concise, and direct with zero unnecessary filler words: "${text}"`,
    friendly: `Rewrite this message in a warm, friendly, collaborative tone: "${text}"`,
   };
   const system = 'You are the Syora Confidential AI writing assistant. Return ONLY the rewritten message text, with no explanations, conversational preamble, quotes, or markdown wrappers.';
   const refined = await callGeminiAPI(system, promptMap[tone]);
   if (refined && refined.trim()) {
    setText(refined.trim());
    setAiOpen(false);
   } else {
    let localRefined = text.trim();
    if (tone === 'concise') {
     localRefined = localRefined.replace(/^(I was just wondering if maybe|Could you possibly please|Just wanted to reach out and say)\s+/i, '');
    } else if (tone === 'professional') {
     localRefined = localRefined[0].toUpperCase() + localRefined.slice(1);
     if (!/[.!?]$/.test(localRefined)) localRefined += '.';
    }
    setText(localRefined);
    setAiOpen(false);
   }
  } catch {
   // Keep original
  } finally {
   setAiBusy(false);
   input.current?.focus();
  }
 }

 return <div className="composer-wrap" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(blocked||busy)return;try{const file=e.dataTransfer.files[0];if(file)choose(pickAttachment(file));}catch(error){setError((error as Error).message)}}}>
  {error&&<p className="inline-error" role="alert">{error}</p>}
  {reply&&<div className="composer-reply" role="status" aria-live="polite"><Reply size={18}/><span><strong>Replying to {users.find(u=>u.id===reply.senderId)?.name}</strong><small>{reply.deleted?'Message deleted':reply.text||reply.attachment?.name}</small></span><IconButton label="Cancel reply" onClick={clearReply}><X size={18}/></IconButton></div>}
  {emoji&&<div className="emoji-picker" role="group" aria-label="Emoji picker"><header>Choose an emoji<IconButton label="Close emoji picker" onClick={()=>setEmoji(false)}><X size={17}/></IconButton></header><div>{emojis.map(e=><button type="button" key={e} aria-label={`Insert ${e}`} onClick={()=>{setText(t=>(t+e).slice(0,10000));input.current?.focus()}}>{e}</button>)}</div></div>}
  {aiOpen&&<div className="composer-ai-popover" role="group" aria-label="Syora AI Assistant"><header><span>Syora AI Assistant</span><IconButton label="Close AI tools" onClick={()=>setAiOpen(false)}><X size={16}/></IconButton></header>{text.trim()?(<div className="composer-ai-actions"><button type="button" className="composer-ai-item" disabled={aiBusy} onClick={()=>void handleRefineTone('polish')}><Sparkles size={16}/><span>{aiBusy?'Refining…':'Polish & Enhance'}</span></button><button type="button" className="composer-ai-item" disabled={aiBusy} onClick={()=>void handleRefineTone('professional')}><Wand2 size={16}/><span>{aiBusy?'Refining…':'Professional Tone'}</span></button><button type="button" className="composer-ai-item" disabled={aiBusy} onClick={()=>void handleRefineTone('concise')}><Wand2 size={16}/><span>{aiBusy?'Refining…':'Make Crisp & Concise'}</span></button><button type="button" className="composer-ai-item" disabled={aiBusy} onClick={()=>void handleRefineTone('friendly')}><Smile size={16}/><span>{aiBusy?'Refining…':'Warm & Friendly'}</span></button></div>):(<div className="composer-ai-actions"><p className="composer-ai-hint">Choose a quick scenario starter or draft with AI:</p><button type="button" className="composer-ai-item" onClick={()=>{setText('Hi! Following up on our project milestones—everything is progressing smoothly. Let me know if you would like to connect briefly.');setAiOpen(false);input.current?.focus();}}><Sparkles size={16}/><span>Quick Status Update</span></button><button type="button" className="composer-ai-item" onClick={()=>{setText('Hi, due to an unavoidable schedule conflict, could we please reschedule our upcoming meeting? Let me know what alternative time works best for you.');setAiOpen(false);input.current?.focus();}}><Sparkles size={16}/><span>Reschedule Meeting</span></button><button type="button" className="composer-ai-item" onClick={()=>{setText('Hi, following up on our previous note when you have a free moment. Looking forward to your thoughts!');setAiOpen(false);input.current?.focus();}}><Sparkles size={16}/><span>Gentle Follow-Up</span></button></div>)}</div>}
  <form onSubmit={e=>{e.preventDefault();void send()}}><div className="composer">
   <FilePicker onSelect={choose} onError={setError} disabled={blocked||busy}/>
   <textarea ref={input} rows={1} aria-label="Message" placeholder={blocked?'This contact is blocked':'Write a message…'} value={text} readOnly={busy} disabled={blocked} maxLength={10000} onChange={e=>{setText(e.target.value);services.typing(conversationId,true);if(typingTimer.current)clearTimeout(typingTimer.current);typingTimer.current=setTimeout(()=>services.typing(conversationId,false),1200)}} onBlur={()=>services.typing(conversationId,false)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send()}if(e.key==='Escape'){setEmoji(false);setAiOpen(false);}}}/>
   <IconButton label="Syora AI Polish" disabled={blocked||busy} onClick={()=>{setAiOpen(!aiOpen);setEmoji(false);}}><Sparkles size={20} className={text.trim() ? "text-accent" : ""}/></IconButton>
   <IconButton label="Choose emoji" disabled={blocked||busy} onClick={()=>{setEmoji(!emoji);setAiOpen(false);}}><Smile size={21}/></IconButton>
   <button type="submit" className="icon-button send-button" aria-label="Send message" disabled={blocked||busy||(!text.trim()&&!attachment)}><Send size={20}/></button>
  </div></form>
  {attachment&&<Modal title="Ready to share?" className="mobile-sheet" onClose={()=>{if(!busy)choose(undefined)}}><AttachmentContent attachment={attachment} preview/><label className="field">Caption<textarea aria-label="Attachment caption" value={text} onChange={e=>setText(e.target.value)} maxLength={10000} readOnly={busy}/></label><p className="demo-disclosure">The file will be shared privately in this conversation.</p><div className="modal-actions"><button className="button secondary" disabled={busy} onClick={()=>choose(undefined)}>Cancel</button><button className="button primary" disabled={busy||blocked} onClick={()=>void send()}>{busy?'Sending…':'Send attachment'}</button></div></Modal>}
 </div>;
}
