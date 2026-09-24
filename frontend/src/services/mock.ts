import { createSeed } from '@/data/seed';
import type { AdminMetrics, AdminNotificationSettings, Attachment, AppState, Preferences, User } from '@/types';
import type { Services } from './contracts';
import { normalizeUsername } from '@/utils/presentation';
const pause = () => new Promise<void>(resolve=>setTimeout(resolve,350));
export class MockServices implements Services {
 private state:AppState=createSeed();
 private settings=new Map<string,Preferences>();
 private hidden=new Map<string,Set<string>>();
 private read=new Map<string,Set<string>>();
 private unread=new Map<string,Map<string,number>>();
 private conversationSettings=new Map<string,Map<string,{muted?:boolean;pinned?:boolean}>>();
 private snapshot:AppState=this.project();
 private listeners=new Set<()=>void>();
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return ()=>{this.listeners.delete(fn)}};
 getSnapshot=()=>this.snapshot;
 private project():AppState {
  const me=this.state.currentUserId;
  if(!me)return {...this.state,users:[],conversations:[],messages:[],friendships:[],statuses:[],preferences:createSeed().preferences};
  const friendships=this.state.friendships.filter(f=>f.from===me||f.to===me);
  const friends=new Set(friendships.filter(f=>f.status==='accepted').map(f=>f.from===me?f.to:f.from));
  const conversations=this.state.conversations.filter(c=>c.participants.includes(me)).map(c=>({...c,pinned:me==='demo'?c.pinned:false,muted:me==='demo'?c.muted:false,...this.conversationSettings.get(me)?.get(c.id),unread:this.unread.get(me)?.get(c.id)??(this.read.get(me)?.has(c.id)?0:me==='demo'?c.unread:0)}));
  const ids=new Set(conversations.map(c=>c.id));
  return {...this.state,conversations,friendships,messages:this.state.messages.filter(m=>ids.has(m.conversationId)&&!this.hidden.get(me)?.has(m.id)),statuses:this.state.statuses.filter(s=>new Date(s.expiresAt).getTime()>Date.now()&&(s.userId===me||(friends.has(s.userId)&&!this.state.preferences.blocked.includes(s.userId))))};
 }
 private update(values:Partial<AppState>){this.state={...this.state,...values};this.snapshot=this.project();this.listeners.forEach(fn=>fn());}
 private identity(){const id=this.state.currentUserId;if(!id)throw new Error('Please sign in to continue.');return id;}
 private user(id:string){const user=this.state.users.find(u=>u.id===id);if(!user)throw new Error('Profile unavailable.');return user;}
 private conversation(id:string){const me=this.identity();const c=this.state.conversations.find(c=>c.id===id&&c.participants.includes(me));if(!c)throw new Error('Conversation unavailable.');return c;}
 private ownedMessage(id:string){const m=this.state.messages.find(m=>m.id===id);if(!m||m.senderId!==this.identity())throw new Error('Message unavailable.');this.conversation(m.conversationId);return m;}
 private signIn(id:string){const preferences=this.settings.get(id)||createSeed().preferences;this.settings.set(id,preferences);this.update({currentUserId:id,preferences});return this.user(id);}
 async forgotPassword(email: string) { await pause(); }
 async resetPassword(token: string, password: string) { await pause(); }
 async enterDemo(){
await pause();return this.signIn('demo');}
 async login(email:string,password:string){await pause();if(password.length<8)throw new Error('Use at least 8 characters for the demo password.');const user=this.state.users.find(u=>u.email.toLowerCase()===email.trim().toLowerCase());if(!user)throw new Error('No profile found in this preview. Create a profile or explore the demo.');return this.signIn(user.id);}
 async register(name:string,username:string,email:string,password:string){await pause();name=name.trim();username=normalizeUsername(username);email=email.trim().toLowerCase();if(!name||name.length>80||password.length<8||!/^\S+@\S+\.\S+$/.test(email)||!/^[a-z0-9_]{3,32}$/.test(username))throw new Error('Check your profile details.');if(this.state.users.some(u=>u.email.toLowerCase()===email))throw new Error('This email already has a preview profile.');if(this.state.users.some(u=>u.username===username))throw new Error('That username is already taken.');const user:User={id:crypto.randomUUID(),name,username,email,about:'',color:'iris'};this.update({users:[...this.state.users,user]});return this.signIn(user.id);}
 logout(){this.update({currentUserId:null});}
 async retryBootstrap(){this.update({sessionReady:true,sessionError:undefined});}
 async updateProfile(values:Partial<Pick<User,'name'|'username'|'about'|'avatar'>>,onProgress?:(percent:number)=>void){const id=this.identity();onProgress?.(15);if(values.name!==undefined&&(!values.name.trim()||values.name.trim().length>80))throw new Error('Use a display name between 1 and 80 characters.');if(values.username!==undefined&&!/^[a-z0-9_]{3,32}$/.test(values.username.trim().replace(/^@/,'')))throw new Error('Use 3–32 lowercase letters, numbers, or underscores.');const next={...values,...(values.name!==undefined?{name:values.name.trim()}:{}),...(values.username!==undefined?{username:values.username.trim().replace(/^@/,'').toLowerCase()}:{})};this.update({users:this.state.users.map(u=>u.id===id?{...u,...next}:u)});onProgress?.(100);}
 async send(conversationId:string,text:string,attachment?:Attachment,replyTo?:string){const c=this.conversation(conversationId);if(c.participants.some(id=>this.state.preferences.blocked.includes(id)))throw new Error('Unblock this contact before sending a message.');if(!text.trim()&&!attachment)return;if(text.length>10000)throw new Error('Keep messages under 10,000 characters.');if(replyTo&&!this.snapshot.messages.some(m=>m.id===replyTo&&m.conversationId===conversationId))throw new Error('Reply message unavailable.');const id=crypto.randomUUID();const me=this.identity();for(const participant of c.participants){if(participant===me)continue;const counts=this.unread.get(participant)||new Map<string,number>();const previous=counts.get(c.id)??(this.read.get(participant)?.has(c.id)?0:participant==='demo'?c.unread:0);counts.set(c.id,previous+1);this.unread.set(participant,counts);}this.update({messages:[...this.state.messages,{id,conversationId,senderId:me,text:text.trim(),attachment,replyTo,createdAt:new Date().toISOString(),receipt:'sending'}]});await pause();this.update({messages:this.state.messages.map(m=>m.id===id&&!m.deleted&&m.receipt==='sending'?{...m,receipt:'sent'}:m)});await pause();this.update({messages:this.state.messages.map(m=>m.id===id&&!m.deleted&&m.receipt!=='read'?{...m,receipt:'delivered'}:m)});}
 typing(_conversationId:string,_active:boolean){}
 async retry(id:string){const message=this.ownedMessage(id);const c=this.conversation(message.conversationId);if(message.deleted||message.receipt!=='failed')return;if(c.participants.some(id=>this.state.preferences.blocked.includes(id)))throw new Error('Unblock this contact before retrying.');this.update({messages:this.state.messages.map(m=>m.id===id?{...m,receipt:'sending'}:m)});await pause();this.update({messages:this.state.messages.map(m=>m.id===id&&!m.deleted&&m.receipt!=='read'?{...m,receipt:'delivered'}:m)});}
 async deleteMessage(id:string,everyone:boolean){const me=this.identity();const message=this.snapshot.messages.find(m=>m.id===id);if(!message)throw new Error('Message unavailable.');this.conversation(message.conversationId);if(everyone){this.ownedMessage(id);this.update({messages:this.state.messages.map(m=>m.id===id?{...m,text:'',attachment:undefined,replyTo:undefined,deleted:true}:m)});}else{const hidden=this.hidden.get(me)||new Set<string>();hidden.add(id);this.hidden.set(me,hidden);this.update({});}}
 markRead(id:string){this.conversation(id);const me=this.identity();const read=this.read.get(me)||new Set<string>();read.add(id);this.read.set(me,read);const counts=this.unread.get(me)||new Map<string,number>();counts.set(id,0);this.unread.set(me,counts);this.update({messages:this.state.messages.map(m=>m.conversationId===id&&m.senderId!==me&&!m.deleted&&m.receipt!=='failed'&&this.state.preferences.receipts?{...m,receipt:'read'}:m)});}
 async toggleConversation(id:string,key:'muted'|'pinned'){this.conversation(id);const me=this.identity();const settings=this.conversationSettings.get(me)||new Map<string,{muted?:boolean;pinned?:boolean}>();const current=this.snapshot.conversations.find(c=>c.id===id)!;settings.set(id,{...settings.get(id),[key]:!current[key]});this.conversationSettings.set(me,settings);this.update({});}
 async request(id:string){const me=this.identity();this.user(id);if(id===me||this.state.preferences.blocked.includes(id))return;const exists=this.state.friendships.some(f=>[f.from,f.to].includes(me)&&[f.from,f.to].includes(id)&&f.status!=='declined');if(!exists)this.update({friendships:[...this.state.friendships,{id:crypto.randomUUID(),from:me,to:id,status:'pending'}]});}
 async respond(id:string,accept:boolean){const me=this.identity();const request=this.state.friendships.find(f=>f.id===id&&f.to===me&&f.status==='pending');if(!request)throw new Error('Friend request unavailable.');if(accept&&this.state.preferences.blocked.includes(request.from))throw new Error('Unblock this profile before accepting.');this.update({friendships:this.state.friendships.map(f=>f.id===id?{...f,status:accept?'accepted':'declined'}:f)});}
 async remove(id:string){const me=this.identity();this.update({friendships:this.state.friendships.filter(f=>!([f.from,f.to].includes(id)&&[f.from,f.to].includes(me)))});}
 async openConversation(id:string){const me=this.identity();this.user(id);if(this.state.preferences.blocked.includes(id))throw new Error('Unblock this contact first.');const accepted=this.state.friendships.some(f=>f.status==='accepted'&&[f.from,f.to].includes(me)&&[f.from,f.to].includes(id));if(!accepted||me===id)throw new Error('An accepted friend request is needed to start a conversation.');const existing=this.state.conversations.find(c=>c.participants.includes(me)&&c.participants.includes(id));if(existing)return existing.id;const conversation={id:crypto.randomUUID(),participants:[me,id],unread:0};this.update({conversations:[conversation,...this.state.conversations]});return conversation.id;}
 async block(id:string){const me=this.identity();this.user(id);if(id===me)throw new Error('You cannot block your own profile.');const blocked=this.state.preferences.blocked;this.updatePreferences({blocked:blocked.includes(id)?blocked.filter(x=>x!==id):[...blocked,id]});}
 async publish(text:string,color:string,attachment?:Attachment,onProgress?:(percent:number)=>void){const me=this.identity();onProgress?.(20);if(!text.trim()&&!attachment)throw new Error('Add a thought or a photo first.');const now=Date.now();this.update({statuses:[{id:crypto.randomUUID(),userId:me,text:text.trim(),color,attachment,createdAt:new Date(now).toISOString(),expiresAt:new Date(now+86400000).toISOString(),viewedBy:[]},...this.state.statuses]});onProgress?.(100);}
 async view(id:string){const me=this.identity();if(!this.snapshot.statuses.some(s=>s.id===id&&new Date(s.expiresAt).getTime()>Date.now()))throw new Error('Status unavailable.');this.update({statuses:this.state.statuses.map(s=>s.id===id&&!s.viewedBy.includes(me)?{...s,viewedBy:[...s.viewedBy,me]}:s)});}
 async removeStatus(id:string){const me=this.identity();if(!this.state.statuses.some(s=>s.id===id&&s.userId===me))throw new Error('Status unavailable.');this.update({statuses:this.state.statuses.filter(s=>s.id!==id)});}
 async loadMessages(_conversationId:string){return false}
 async loadOlderMessages(_conversationId:string){return false}
 async searchUsers(query:string,signal?:AbortSignal){if(signal?.aborted)throw new DOMException('Aborted','AbortError');const value=normalizeUsername(query);return this.state.users.filter(user=>user.id!==this.state.currentUserId&&(normalizeUsername(user.username).startsWith(value)||user.name.toLowerCase().includes(value))).slice(0,20)}
 async getAccessUrl(_attachmentId:string){return ""}
 async getAdminMetrics():Promise<AdminMetrics>{const me=this.user(this.identity());if(me.role!=="admin")throw new Error("Administrator access is required.");const timestamp=new Date().toISOString();return {signedInUsers:1,previouslySignedInUsers:0,people:[{userId:me.id,displayName:me.name,username:me.username,totalSessionCount:1,activeSessionCount:1,lastSignedInAt:timestamp,lastActiveAt:timestamp,isCurrentUser:true,canRevoke:false}]};}
 async revokeAdminSessions(_userId:string):Promise<void>{await pause();}
 async getAdminNotificationSettings():Promise<AdminNotificationSettings>{const me=this.user(this.identity());if(me.role!=="admin")throw new Error("Administrator access is required.");return {loginAlerts:true,messageAlerts:true,messagePreview:true,pushEnabled:false,pushSupported:false};}
 async updateAdminNotificationSettings(values:Partial<Pick<AdminNotificationSettings,'loginAlerts'|'messageAlerts'|'messagePreview'>>){return {...await this.getAdminNotificationSettings(),...values};}
 async enableAdminPush():Promise<AdminNotificationSettings>{throw new Error('Push delivery is unavailable in preview mode.');}
 async disableAdminPush(){return this.getAdminNotificationSettings();}
 async updatePreferences(values:Partial<Preferences>){const me=this.identity();const preferences={...this.state.preferences,...values};this.settings.set(me,preferences);this.update({preferences});}
}
export const services:Services=new MockServices();
