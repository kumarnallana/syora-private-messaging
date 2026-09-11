import type { AppState, Attachment, Message, Preferences, User, StatusPost } from '@/types';
export interface AuthService { login(email: string,password: string): Promise<User>; register(name: string,email: string,password: string): Promise<User>; enterDemo(): Promise<User>; logout():void; updateProfile(values:Partial<Pick<User,'name'|'about'|'avatar'>>):void; }
export interface ChatService { send(conversationId:string,text:string,attachment?:Attachment,replyTo?:string):Promise<void>; retry(id:string):Promise<void>; deleteMessage(id:string,everyone:boolean):void; markRead(id:string):void; toggleConversation(id:string,key:'muted'|'pinned'):void; }
export interface ContactService { request(id:string):void; respond(id:string,accept:boolean):void; remove(id:string):void; openConversation(id:string):string; block(id:string):void; }
export interface StatusService { publish(text:string,color:string,attachment?:Attachment):void; view(id:string):void; removeStatus(id:string):void; }
export interface Services extends AuthService,ChatService,ContactService,StatusService { subscribe(listener:()=>void):()=>void; getSnapshot():AppState; updatePreferences(values:Partial<Preferences>):void; }
export type { Message, StatusPost };
