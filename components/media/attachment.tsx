'use client';
import { useRef, useState } from 'react';
import { Download, FileText, Paperclip } from 'lucide-react';
import { Modal, fileSize, pickAttachment } from '@/components/shared/ui';
import type { Attachment } from '@/types';
export function FilePicker({onSelect,onError,mediaOnly=false,disabled=false}:{onSelect:(file:Attachment)=>void;onError:(error:string)=>void;mediaOnly?:boolean;disabled?:boolean}) {
 const input=useRef<HTMLInputElement>(null);
 return <><button type="button" className="icon-button" aria-label={mediaOnly?'Add photo or video':'Attach file'} disabled={disabled} onClick={()=>input.current?.click()}><Paperclip size={21}/></button><input ref={input} type="file" hidden accept={mediaOnly?'image/*,video/*':'image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv'} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(mediaOnly&&!/^(image|video)\//.test(file.type))throw new Error('Choose a photo or video.');onSelect(pickAttachment(file));onError('');}catch(error){onError((error as Error).message)}}}/></>;
}
export function AttachmentContent({attachment,preview=false}:{attachment:Attachment;preview?:boolean}) {
 const [view,setView]=useState(false);
 const [error,setError]=useState(false);
 return <div className="attachment-content">
  {attachment.type==='image'?<button type="button" className="image-message" aria-label={`View ${attachment.name}`} onClick={()=>setView(true)}><img src={attachment.url} alt={attachment.name} loading="lazy" onError={()=>setError(true)}/></button>:attachment.type==='video'?<video className="video-message" src={attachment.url} controls playsInline preload="metadata" aria-label={attachment.name} onError={()=>setError(true)}/>:<div className="document-message"><FileText size={29}/><span><strong>{attachment.name}</strong><small>{attachment.name.split('.').at(-1)?.toUpperCase()} · {fileSize(attachment.size)}</small></span><button type="button" className="icon-button" aria-label={`Open ${attachment.name}`} onClick={()=>setView(true)}><FileText size={18}/></button><a className="icon-button" href={attachment.url} download={attachment.name} aria-label={`Download ${attachment.name}`}><Download size={18}/></a></div>}
  {error&&<p role="alert" className="inline-error">This media could not be displayed. <a href={attachment.url} download={attachment.name}>Download file</a></p>}
  {preview&&<p className="file-caption">{attachment.name} · {fileSize(attachment.size)}</p>}
  {view&&<Modal title={attachment.name} wide onClose={()=>setView(false)}>{attachment.type==='image'?<img className="media-viewer" src={attachment.url} alt={attachment.name}/>:attachment.mime==='application/pdf'?<iframe className="pdf-viewer" title={attachment.name} src={attachment.url}/>:<p className="modal-copy">Download this document to open it in a compatible application.</p>}<div className="modal-actions"><a className="button secondary" href={attachment.url} download={attachment.name}><Download size={17}/> Download</a></div></Modal>}
 </div>;
}
