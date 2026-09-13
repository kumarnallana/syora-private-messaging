'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Ban, Check, LoaderCircle, MessageCircle, RotateCcw, Search, UserMinus, UserPlus, X } from 'lucide-react';
import { useApp } from '@/stores/use-app';
import { Avatar, Empty, IconButton } from '@/components/shared/ui';
import { MobileScreenHeader, PageHeader } from '@/components/shell';
import { usernameLabel } from '@/utils/presentation';
import type { User } from '@/types';

type SearchState = 'initial' | 'searching' | 'loaded' | 'error';

export function Contacts() {
  const { me, users, friendships, services, preferences } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const [searchState, setSearchState] = useState<SearchState>('initial');
  const [results, setResults] = useState<User[]>([]);
  const [searchRetry, setSearchRetry] = useState(0);
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string }>();
  const [actingId, setActingId] = useState<string>();
  const selected = users.find(user => user.id !== me!.id && user.id === searchParams.get('person'));
  const searchSequence = useRef(0);
  const relationship = (id: string) => {
    if (id === me!.id) return undefined;
    return friendships.find(item =>
      (item.from === me!.id && item.to === id) ||
      (item.to === me!.id && item.from === id),
    );
  };
  const incoming = friendships.filter(item => item.to === me!.id && item.status === 'pending');
  const friends = users.filter(user => user.id !== me!.id && relationship(user.id)?.status === 'accepted');

  useEffect(() => {
    const value = query.trim();
    const sequence = ++searchSequence.current;
    const controller = new AbortController();
    if (!value) { setSearchState('initial'); setResults([]); return; }
    setSearchState('searching');
    const timer = window.setTimeout(() => {
      void services.searchUsers(value, controller.signal).then(found => {
        if (sequence !== searchSequence.current) return;
        setResults(found.filter(user => user.id !== me!.id).slice(0, 20));
        setSearchState('loaded');
      }).catch(cause => {
        if (sequence !== searchSequence.current) return;
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setResults([]);
        setSearchState('error');
      });
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [me, query, searchRetry, services]);

  async function open(user: User) {
    await act(user.id, `Opening your conversation with ${user.name}…`, async () => {
      const id = await services.openConversation(user.id);
      router.push(`/chats?conversation=${id}`);
    });
  }

  async function act(id: string, success: string, work: () => Promise<unknown>) {
    if (actingId) return;
    setActingId(id);
    setNotice(undefined);
    try { await work(); setNotice({ kind: 'success', text: success }); }
    catch (cause) { setNotice({ kind: 'error', text: cause instanceof Error ? cause.message : 'That action could not be completed.' }); }
    finally { setActingId(undefined); }
  }

  function actions(user: User) {
    const relation = relationship(user.id);
    const accepted = relation?.status === 'accepted';
    const pending = relation?.status === 'pending';
    const incomingRequest = pending && relation?.to === me!.id;
    const blocked = preferences.blocked.includes(user.id);
    const busy = actingId === user.id;
    return <div className="row-actions" aria-busy={busy}>{accepted && !blocked && <button className="button secondary small" disabled={busy} onClick={() => void open(user)}>{busy ? <LoaderCircle className="spin" size={16}/> : <MessageCircle size={16}/>} Message</button>}{!relation && !blocked && <button className="button secondary small" disabled={busy} onClick={() => void act(user.id, `Friend request sent to ${user.name}.`, () => services.request(user.id))}>{busy ? <LoaderCircle className="spin" size={16}/> : <UserPlus size={16}/>} Add friend</button>}{pending && <span className="status-pill">{incomingRequest ? 'Incoming request' : 'Request sent'}</span>}{accepted && !blocked && <IconButton disabled={busy} label={`Remove ${user.name} from friends`} onClick={() => void act(user.id, `${user.name} was removed from your friends.`, () => services.remove(user.id))}><UserMinus size={18}/></IconButton>}{blocked ? <button className="button secondary small" disabled={busy} onClick={() => void act(user.id, `${user.name} is unblocked.`, () => services.block(user.id))}>{busy && <LoaderCircle className="spin" size={16}/>} Unblock</button> : <IconButton disabled={busy} label={`Block ${user.name}`} onClick={() => void act(user.id, `${user.name} is blocked.`, () => services.block(user.id))}><Ban size={17}/></IconButton>}</div>;
  }

  function identity(user: User) {
    return <><Avatar user={user}/><span className="person-copy"><strong>{user.name}</strong><small>{usernameLabel(user.username)}</small><p>{preferences.blocked.includes(user.id) ? 'Blocked' : user.about}</p></span></>;
  }

  function personRow(user: User) {
    const blocked = preferences.blocked.includes(user.id);
    return <article className={`person-card ${blocked ? 'blocked-card' : ''}`} key={user.id}><button className="person-identity" onClick={() => router.push(`/contacts?person=${encodeURIComponent(user.id)}`)}>{identity(user)}</button>{actions(user)}</article>;
  }

  if (selected) return <div className="page-view contact-detail-screen"><MobileScreenHeader title="Contact" onBack={() => router.back()}/><div className="person-detail contact-profile"><Avatar user={selected} size="large"/><h1>{selected.name}</h1><strong className="username">{usernameLabel(selected.username)}</strong><p>{selected.about}</p>{selected.email && <small>{selected.email}</small>}{actions(selected)}</div>{notice && <p className={`notice is-${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>}</div>;

  return <div className="page-view contacts-page"><MobileScreenHeader title="People"/><PageHeader title="People" description="Find someone by display name or unique @username."/><div className="people-workspace"><label className="search-field page-search"><Search size={18}/><input aria-label="Search people" placeholder="Search by name or @username" value={query} autoComplete="off" autoCapitalize="none" spellCheck={false} onChange={event => { setQuery(event.target.value); setNotice(undefined); }}/>{searchState === 'searching' && <LoaderCircle className="spin" size={17}/>} {query && <IconButton label="Clear search" onClick={() => setQuery('')}><X size={16}/></IconButton>}</label>{searchState === 'initial' && <p className="search-initial-hint">Search for people by name or @username.</p>}{notice && <p className={`notice page-notice is-${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>}{incoming.length > 0 && <section><h2 className="section-heading">Friend requests <span>{incoming.length}</span></h2><div className="card-list">{incoming.map(request => { const user = users.find(item => item.id === request.from); const busy = user && actingId === user.id; return user && <article className="person-card" key={request.id}><button className="person-identity" onClick={() => router.push(`/contacts?person=${encodeURIComponent(user.id)}`)}>{identity(user)}</button><div className="row-actions"><button className="button primary small" disabled={busy} onClick={() => void act(user.id, `${user.name} is now your friend.`, () => services.respond(request.id, true))}>{busy ? <LoaderCircle className="spin" size={16}/> : <Check size={16}/>} Accept</button><IconButton disabled={busy} label={`Decline request from ${user.name}`} onClick={() => void act(user.id, `Request from ${user.name} declined.`, () => services.respond(request.id, false))}><X size={18}/></IconButton></div></article>; })}</div></section>}{searchState === 'initial' ? <section><h2 className="section-heading">Friends <span>{friends.length}</span></h2><div className="card-list">{friends.length ? friends.map(personRow) : <Empty title="Find your people" description="Search by name or @username to send a friend request."/>}</div></section> : <section><h2 className="section-heading">Search results {searchState === 'loaded' && <span>{results.length}</span>}</h2><div className="card-list">{searchState === 'searching' ? <div className="searching-state" role="status"><LoaderCircle className="spin"/> Searching people…</div> : searchState === 'loaded' && results.length ? results.map(personRow) : searchState === 'loaded' ? <Empty title={`No people found for “${query.trim()}”`} description="Check the spelling or try a different name or username."/> : <div className="search-error" role="alert"><p>Search couldn’t be completed. Try again.</p><button className="button secondary small" onClick={() => setSearchRetry(value => value + 1)}><RotateCcw size={15}/> Try again</button></div>}</div></section>}</div></div>;
}
