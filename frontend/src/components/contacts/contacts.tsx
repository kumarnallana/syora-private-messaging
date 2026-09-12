'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, Check, LoaderCircle, MessageCircle, Search, UserMinus, UserPlus, X } from 'lucide-react';
import { useApp } from '@/stores/use-app';
import { Avatar, Empty, IconButton } from '@/components/shared/ui';
import { MobileScreenHeader, PageHeader, PreviewNote } from '@/components/shell';
import type { User } from '@/types';

type SearchState = 'initial' | 'searching' | 'loaded' | 'error';

export function Contacts() {
  const { me, users, friendships, services, preferences } = useApp();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [searchState, setSearchState] = useState<SearchState>('initial');
  const [results, setResults] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<User>();
  const searchSequence = useRef(0);
  const relationship = (id: string) => friendships.find(item => [item.from, item.to].includes(me!.id) && [item.from, item.to].includes(id));
  const incoming = friendships.filter(item => item.to === me!.id && item.status === 'pending');
  const friends = users.filter(user => relationship(user.id)?.status === 'accepted');

  useEffect(() => {
    const value = query.trim();
    const sequence = ++searchSequence.current;
    if (!value) { setSearchState('initial'); setResults([]); setError(''); return; }
    setSearchState('searching'); setError('');
    const delay = value.startsWith('@') && value.length >= 4 ? 0 : 180;
    const timer = setTimeout(() => {
      void services.searchUsers(value).then(found => {
        if (sequence !== searchSequence.current) return;
        setResults(found); setSearchState('loaded');
      }).catch(cause => {
        if (sequence !== searchSequence.current) return;
        setError(cause instanceof Error ? cause.message : "Search couldn't be completed. Try again.");
        setSearchState('error');
      });
    }, delay);
    return () => clearTimeout(timer);
  }, [query, services]);

  async function open(id: string) {
    try { router.push(`/chats?conversation=${await services.openConversation(id)}`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Conversation could not be opened.'); }
  }
  async function act(work: () => Promise<unknown>) {
    try { setError(''); await work(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'That action could not be completed.'); }
  }
  function actions(user: User) {
    const relation = relationship(user.id);
    const accepted = relation?.status === 'accepted';
    const pending = relation?.status === 'pending';
    const blocked = preferences.blocked.includes(user.id);
    return <div className="row-actions">{accepted && !blocked && <button className="button secondary small" onClick={() => void open(user.id)}><MessageCircle size={16}/> Message</button>}{!relation && !blocked && <button className="button secondary small" onClick={() => void act(() => services.request(user.id))}><UserPlus size={16}/> Add friend</button>}{pending && <span className="status-pill">{relation.from === me!.id ? 'Request sent' : 'Awaiting response'}</span>}{accepted && !blocked && <IconButton label={`Remove ${user.name} from friends`} onClick={() => void act(() => services.remove(user.id))}><UserMinus size={18}/></IconButton>}{blocked ? <button className="button secondary small" onClick={() => void act(() => services.block(user.id))}><Ban size={16}/> Unblock</button> : <IconButton label={`Block ${user.name}`} onClick={() => void act(() => services.block(user.id))}><Ban size={17}/></IconButton>}</div>;
  }
  function personRow(user: User) {
    const blocked = preferences.blocked.includes(user.id);
    return <article className={`person-card ${blocked ? 'blocked-card' : ''}`} key={user.id}><button className="person-identity" onClick={() => setSelected(user)}><Avatar user={user}/><span><strong>{user.name}</strong><small>@{user.username}</small><p>{blocked ? 'Blocked' : user.about}</p></span></button>{actions(user)}</article>;
  }

  if (selected) return <div className="page-view contact-detail-screen"><MobileScreenHeader title="Contact" onBack={() => setSelected(undefined)}/><div className="person-detail contact-profile"><Avatar user={selected} size="large"/><h1>{selected.name}</h1><strong className="username">@{selected.username}</strong><p>{selected.about}</p>{selected.email && <small>{selected.email}</small>}{actions(selected)}</div></div>;
  return <div className="page-view"><MobileScreenHeader title="People"/><PageHeader eyebrow="YOUR CIRCLE" title="People" description="Find someone by display name or unique @username."/>
    <label className="search-field page-search"><Search size={18}/><input aria-label="Search people" placeholder="Search by name or @username" value={query} onChange={event => setQuery(event.target.value)}/>{searchState === 'searching' && <LoaderCircle className="spin" size={17}/>} {query && <IconButton label="Clear search" onClick={() => setQuery('')}><X size={16}/></IconButton>}</label>
    {error && <p className="inline-error page-error" role="alert">{error}</p>}
    {incoming.length > 0 && <section><h2 className="section-heading">Friend requests <span>{incoming.length}</span></h2><div className="card-list">{incoming.map(request => { const user = users.find(item => item.id === request.from); return user && <article className="person-card" key={request.id}><button className="person-identity" onClick={() => setSelected(user)}><Avatar user={user}/><span><strong>{user.name}</strong><small>@{user.username}</small><p>{user.about}</p></span></button><div className="row-actions"><button className="button primary small" onClick={() => void act(() => services.respond(request.id, true))}><Check size={16}/> Accept</button><IconButton label={`Decline request from ${user.name}`} onClick={() => void act(() => services.respond(request.id, false))}><X size={18}/></IconButton></div></article>; })}</div></section>}
    {searchState === 'initial' ? <section><h2 className="section-heading">Friends <span>{friends.length}</span></h2><div className="card-list">{friends.length ? friends.map(personRow) : <Empty title="Find your people" description="Search by name or @username to send a friend request."/>}</div></section> : <section><h2 className="section-heading">Search results {searchState === 'loaded' && <span>{results.length}</span>}</h2><div className="card-list">{searchState === 'searching' ? <div className="searching-state" role="status"><LoaderCircle className="spin"/> Searching people…</div> : searchState === 'loaded' && results.length ? results.map(personRow) : searchState === 'loaded' ? <Empty title={`No people found for “${query.trim()}”`} description="Check the spelling or try a different name or username."/> : null}</div></section>}
    <PreviewNote/>
  </div>;
}
