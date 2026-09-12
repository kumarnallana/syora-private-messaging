import type { AppState, User, Message } from '@/types';
const people: User[] = [
 { id:'demo', name:'Alex Morgan', email:'alex@syora.demo', about:'A little less noise. A little more connection.',color:'iris'},
 { id:'maya', name:'Maya Chen', email:'maya@syora.demo', about:'Collecting moments, mostly outdoors.',color:'peach',online:true},
 { id:'leo', name:'Leo Martinez', email:'leo@syora.demo', about:'Music on. World off.',color:'blue',lastSeen:'20 minutes ago'},
 { id:'aisha', name:'Aisha Patel', email:'aisha@syora.demo', about:'Making space for good things.',color:'rose',online:true},
 { id:'noah', name:'Noah Williams', email:'noah@syora.demo', about:'Probably looking for coffee.',color:'sand',lastSeen:'1 hour ago'},
 { id:'sophie', name:'Sophie Laurent', email:'sophie@syora.demo', about:'See you on the next adventure.',color:'mint',lastSeen:'yesterday'},
 { id:'ethan', name:'Ethan Brooks', email:'ethan@syora.demo', about:'One day at a time.',color:'blue',lastSeen:'3 hours ago'},
 { id:'olivia', name:'Olivia Park', email:'olivia@syora.demo', about:'Designing a slower life.',color:'rose',online:true},
 { id:'james', name:'James Wilson', email:'james@syora.demo', about:'Always up for a good conversation.',color:'sand'},
];
export function createSeed(): AppState {
 const now = Date.now();
 const stamp = (minutes: number) => new Date(now - minutes * 60000).toISOString();
 const message = (id:string,conversationId:string,senderId:string,text:string,minutes:number,extra:Partial<Message>={}):Message => ({id,conversationId,senderId,text,createdAt:stamp(minutes),receipt:'read',...extra});
 return { sessionReady:true,currentUserId:null,users:structuredClone(people),
 conversations: ['maya','leo','aisha','noah','sophie','ethan'].map((id,i)=>({id:'chat-'+id,participants:['demo',id],unread:i===0?2:i===2?1:0,pinned:i<2,muted:i===4,typing:i===2})),
 messages:[
 message('m1','chat-maya','maya','Hey! Have you decided where we should go this weekend?',70),
 message('m2','chat-maya','demo','Somewhere with fresh air, no deadlines, and really good coffee.',68),
 message('m3','chat-maya','maya','I think I found our spot ☀️',66),
 message('m4','chat-maya','maya','A quiet morning here? Yes please.',65,{attachment:{id:'mountain',name:'weekend-escape.jpg',type:'image',mime:'image/jpeg',size:248000,url:'/media/weekend.jpg'}}),
 message('m5','chat-maya','demo','Okay, I’m sold. That view is unreal.',62,{replyTo:'m4'}),
 message('m6','chat-maya','demo','Saturday morning? I’ll bring the playlist.',61),
 message('m7','chat-maya','maya','Perfect. I’ll handle the coffee ☕',3),
message('m8','chat-maya','maya','Sending you the trail guide too. The lake loop looks beautiful.',2,{attachment:{id:'guide',name:'Weekend trail guide.pdf',type:'document',mime:'application/pdf',size:840,url:'data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNSAwIFIgPj4gPj4gPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCAxMzAgPj4Kc3RyZWFtCkJUIC9GMSAyMiBUZiA3MiA3MDAgVGQgKFNZT1JBIFdlZWVuZCBUcmFpbCBHdWlkZSkgVGogMCAtMzggVGQgL0YxIDEyIFRmIChGcm9udGVuZCBwcmV2aWV3IGRvY3VtZW50IGZvciBhdHRhY2htZW50IGludGVyYWN0aW9ucy4pIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKNSAwIG9iago8PCAvVHlwZSAvRm9udCAvU3VidHlwZSAvVHlwZTEgL0Jhc2VGb250IC9IZWx2ZXRpY2EgPj4KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDU4IDAwMDAwIG4gCjAwMDAwMDAxMTUgMDAwMDAgbiAKMDAwMDAwMDI0MSAwMDAwMCBuIAowMDAwMDAwNDI3IDAwMDAwIG4gCnRyYWlsZXIKPDwgL1NpemUgNiAvUm9vdCAxIDAgUiA+PgpzdGFydHhyZWYKNDU4CiUlRU9GCg=='}}),
 message('l1','chat-leo','leo','This has been on repeat all morning 🎧',145),
 message('l2','chat-leo','demo','Your playlists never miss.',140),
 message('l3','chat-leo','leo','Wait until you hear the next one.',110),
 message('a1','chat-aisha','aisha','Dinner at 7? I know a lovely little place.',45),
 message('n1','chat-noah','noah','A few seconds of calm from today.',180,{attachment:{id:'clip',name:'afternoon.mp4',type:'video',mime:'video/mp4',size:1128375,url:'/media/afternoon.mp4'}}),
 message('n2','chat-noah','demo','Needed this. Thank you.',175,{receipt:'delivered'}),
 message('s1','chat-sophie','sophie','You have to send me those photos!',1440),
 message('e1','chat-ethan','demo','Let’s catch up soon.',1500,{receipt:'failed'}),
 ],
 friendships:[...['maya','leo','aisha','noah','sophie','ethan'].map(id=>({id:'friend-'+id,from:'demo',to:id,status:'accepted' as const})),{id:'request-olivia',from:'olivia',to:'demo',status:'pending'}],
 statuses:[{id:'s-maya',userId:'maya',text:'Taking the scenic route.',color:'#40504b',attachment:{id:'status-photo',name:'weekend.jpg',type:'image',mime:'image/jpeg',size:248000,url:'/media/weekend.jpg'},createdAt:stamp(24),expiresAt:new Date(now+23*3600000).toISOString(),viewedBy:[]},{id:'s-aisha',userId:'aisha',text:'The best plans leave a little room for the unexpected.',color:'#524068',createdAt:stamp(80),expiresAt:new Date(now+22*3600000).toISOString(),viewedBy:[]},{id:'s-noah',userId:'noah',text:'A moment to pause.',color:'#314556',attachment:{id:'status-video',name:'afternoon.mp4',type:'video',mime:'video/mp4',size:1128375,url:'/media/afternoon.mp4'},createdAt:stamp(150),expiresAt:new Date(now+21*3600000).toISOString(),viewedBy:[]}],
 preferences:{lastSeen:'Friends',photo:'Friends',status:'Friends',receipts:true,notifications:true,sound:false,appearance:'dark',compact:false,blocked:[]},
 };
}
