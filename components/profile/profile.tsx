'use client';
import { useEffect, useRef, useState } from 'react';
import { Camera, Mail, Save } from 'lucide-react';
import { useApp } from '@/stores/use-app';
import { Avatar, pickAttachment } from '@/components/shared/ui';
import { PageHeader, PreviewNote } from '@/components/shell';

export function Profile(){
 const {me,services}=useApp(); const [name,setName]=useState(me!.name); const [about,setAbout]=useState(me!.about); const [notice,setNotice]=useState(''); const input=useRef<HTMLInputElement>(null); const temporary=useRef<string|undefined>(undefined);
 useEffect(()=>()=>{if(temporary.current)URL.revokeObjectURL(temporary.current)},[]);
 function photo(file?:File){if(!file)return;try{const item=pickAttachment(file);if(item.type!=='image'){URL.revokeObjectURL(item.url);throw new Error('Choose an image for your profile photo.')}if(temporary.current)URL.revokeObjectURL(temporary.current);temporary.current=item.url;services.updateProfile({avatar:item.url});setNotice('Profile photo updated for this preview.')}catch(e){setNotice((e as Error).message)}}
 function save(e:React.FormEvent){e.preventDefault();try{services.updateProfile({name,about});setNotice('Profile updated.')}catch(e){setNotice((e as Error).message)}}
 return <div className="page-view narrow"><PageHeader eyebrow="YOUR PROFILE" title="Make it yours" description="Choose how you appear to people in your circle."/><div className="profile-editor"><div className="avatar-editor"><Avatar user={me!} size="large"/><button className="icon-button" onClick={()=>input.current?.click()} aria-label="Change profile photo"><Camera size={19}/></button><input ref={input} hidden type="file" accept="image/*" onChange={e=>{photo(e.target.files?.[0]);e.target.value=''}}/></div><form onSubmit={save}><label className="field">Display name<input value={name} maxLength={80} onChange={e=>setName(e.target.value)} required/></label><label className="field">About<textarea value={about} maxLength={160} onChange={e=>setAbout(e.target.value)} placeholder="A little about you"/></label><label className="field">Email<div className="readonly-field"><Mail size={17}/><span>{me!.email}</span></div><small>Email changes will be available when accounts are connected.</small></label>{notice&&<p className="notice" role="status">{notice}</p>}<button className="button primary" type="submit"><Save size={17}/> Save profile</button></form></div><PreviewNote/></div>;
}
