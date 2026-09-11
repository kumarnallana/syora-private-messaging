'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, Check, MessageCircle, Search, UserMinus, UserPlus, X } from 'lucide-react';
import { useApp } from '@/stores/use-app';
import { Avatar, Empty, IconButton } from '@/components/shared/ui';
import { MobileScreenHeader, PageHeader, PreviewNote } from '@/components/shell';
import type { User } from '@/types';

export function Contacts(){
 const {me,users,friendships,services,preferences}=useApp();
 const router=useRouter(); const [query,setQuery]=useState(''); const [error,setError]=useState(''); const [selected,setSelected]=useState<User>();
 const relationship=(id:string)=>friendships.find(f=>[f.from,f.to].includes(me!.id)&&[f.from,f.to].includes(id));
 const incoming=friendships.filter(f=>f.to===me!.id&&f.status==='pending');
 const results=users.filter(u=>u.id!==me!.id&&u.name.toLowerCase().includes(query.toLowerCase()));
 function open(id:string){try{router.push(`/chats?conversation=${services.openConversation(id)}`)}catch(e){setError((e as Error).message)}}
 function actions(user:User){const rel=relationship(user.id);const accepted=rel?.status==='accepted';const pending=rel?.status==='pending';const blocked=preferences.blocked.includes(user.id);return <div className="row-actions">{accepted&&!blocked&&<button className="button secondary small" onClick={()=>open(user.id)}><MessageCircle size={16}/> Message</button>}{!rel&&!blocked&&<button className="button secondary small" onClick={()=>services.request(user.id)}><UserPlus size={16}/> Add</button>}{pending&&<span className="status-pill">{rel.from===me!.id?'Request sent':'Awaiting response'}</span>}{accepted&&!blocked&&<IconButton label={`Remove ${user.name} from friends`} onClick={()=>services.remove(user.id)}><UserMinus size={18}/></IconButton>}{blocked&&<button className="button secondary small" onClick={()=>services.block(user.id)}><Ban size={16}/> Unblock</button>}</div>}
 if(selected)return <div className="page-view contact-detail-screen"><MobileScreenHeader title="Contact" onBack={()=>setSelected(undefined)}/><div className="person-detail contact-profile"><Avatar user={selected} size="large"/><h1>{selected.name}</h1><p>{selected.about}</p><small>{selected.email}</small>{actions(selected)}</div></div>;
 return <div className="page-view"><MobileScreenHeader title="Contacts"/><PageHeader eyebrow="YOUR CIRCLE" title="Contacts" description="Find people, manage requests, and start conversations with accepted friends."/>
  <label className="search-field page-search"><Search size={18}/><input aria-label="Search people" placeholder="Search people by name" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<IconButton label="Clear search" onClick={()=>setQuery('')}><X size={16}/></IconButton>}</label>
  {error&&<p className="inline-error" role="alert">{error}</p>}
  {incoming.length>0&&<section><h2 className="section-heading">Friend requests <span>{incoming.length}</span></h2><div className="card-list">{incoming.map(request=>{const user=users.find(u=>u.id===request.from)!;return <article className="person-card" key={request.id}><button className="person-identity" onClick={()=>setSelected(user)}><Avatar user={user}/><span><strong>{user.name}</strong><p>{user.about}</p></span></button><div className="row-actions"><button className="button primary small" onClick={()=>services.respond(request.id,true)}><Check size={16}/> Accept</button><IconButton label={`Decline request from ${user.name}`} onClick={()=>services.respond(request.id,false)}><X size={18}/></IconButton></div></article>})}</div></section>}
  <section><h2 className="section-heading">People</h2><div className="card-list">{results.map(user=>{const blocked=preferences.blocked.includes(user.id);return <article className={`person-card ${blocked?'blocked-card':''}`} key={user.id}><button className="person-identity" onClick={()=>setSelected(user)}><Avatar user={user}/><span><strong>{user.name}</strong><p>{blocked?'Blocked':user.about}</p></span></button>{actions(user)}</article>})}{!results.length&&<Empty title="No people found" description="Try a different name."/>}</div></section><PreviewNote/>
 </div>;
}