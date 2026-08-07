// Pegue aquí la configuración web de Firebase. Vacía = modo demo local.
export const firebaseConfig = {
  apiKey: "AIzaSyDlv_qH1Kx6-yjHI723_PAnpfo0Hq8SoXo",
  authDomain: "streamlab-b9122.firebaseapp.com",
  projectId: "streamlab-b9122",
  storageBucket: "streamlab-b9122.firebasestorage.app",
  messagingSenderId: "789036572548",
  appId: "1:789036572548:web:5848484e9374a06ebd47d1"
};
export const enabled=Boolean(firebaseConfig.apiKey&&firebaseConfig.projectId);
export const normalizeCode=value=>String(value||'').trim().toLowerCase().replace(/[^a-z0-9áéíóúñ-]+/gi,'-');
const bus=new EventTarget(),localKey=code=>`odisea:experience:${normalizeCode(code)}`;
const demoRead=code=>JSON.parse(localStorage.getItem(localKey(code))||'null');
const demoWrite=(code,patch)=>{const current=demoRead(code)||{code:String(code).trim(),active:false,nodeCount:10,teams:{}};const next={...current,...patch};localStorage.setItem(localKey(code),JSON.stringify(next));bus.dispatchEvent(new CustomEvent('change',{detail:{code:normalizeCode(code),data:next}}));return next};
let api={};
if(enabled){
 const [{initializeApp},{getAuth,signInAnonymously,signInWithPopup,signOut,GoogleAuthProvider,onAuthStateChanged},{getFirestore,doc,setDoc,addDoc,deleteDoc,collection,onSnapshot,serverTimestamp,query,where,orderBy,limit,getDoc,getDocs}]=await Promise.all([import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js')]);
 const app=initializeApp(firebaseConfig),db=getFirestore(app),auth=getAuth(app);
 api={
  async load(code){const s=await getDoc(doc(db,'experiences',normalizeCode(code)));return s.exists()?{id:s.id,...s.data()}:null},
  async join(code,t){const experience=await this.load(code);if(!experience?.active)throw new Error('Esta actividad no existe o todavía no ha comenzado.');const c=await signInAnonymously(auth),id=normalizeCode(t.name)+'-'+c.user.uid.slice(0,6);await setDoc(doc(db,'experiences',normalizeCode(code),'teams',id),{...t,uid:c.user.uid,updatedAt:serverTimestamp()},{merge:true});return{...t,id,uid:c.user.uid,experienceId:normalizeCode(code)}},
  async adminLogin(){const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});const credential=await signInWithPopup(auth,provider);if(credential.user.uid!=='TVmbMyACnKZ8RxqcnBSncsz3umx2'){await signOut(auth);throw new Error('Esta cuenta Google no está autorizada como docente.')}return credential},
  restoreAdmin:()=>new Promise(resolve=>{const stop=onAuthStateChanged(auth,user=>{stop();resolve(user?.uid==='TVmbMyACnKZ8RxqcnBSncsz3umx2'?user:null)})}),
  save:(code,team,p)=>Promise.all([addDoc(collection(db,'experiences',normalizeCode(code),'attempts'),{...p,teamId:team.id,teamName:team.name,validated:false,createdAt:serverTimestamp()}),setDoc(doc(db,'experiences',normalizeCode(code),'teams',team.id),{name:team.name,uid:team.uid,updatedAt:serverTimestamp()},{merge:true})]),
  watchExp:(code,cb)=>onSnapshot(doc(db,'experiences',normalizeCode(code)),s=>cb(s.exists()?{id:s.id,...s.data()}:null)),
  watchBoard:(code,cb)=>onSnapshot(query(collection(db,'experiences',normalizeCode(code),'attempts'),where('validated','==',true)),s=>cb(s.docs.map(d=>({id:d.id,...d.data()})))),
  watchAttempts:(code,cb,onError=()=>{})=>onSnapshot(query(collection(db,'experiences',normalizeCode(code),'attempts'),orderBy('createdAt','desc')),s=>cb(s.docs.map(d=>({id:d.id,...d.data()})),onError),
  async listAttempts(code){const s=await getDocs(query(collection(db,'experiences',normalizeCode(code),'attempts'),orderBy('createdAt','desc')));return s.docs.map(d=>({id:d.id,...d.data()}))},
  validateAttempt:(code,id,validated)=>setDoc(doc(db,'experiences',normalizeCode(code),'attempts',id),{validated,validatedAt:validated?serverTimestamp():null},{merge:true}),
  async deleteAttempt(code,id){const exp=normalizeCode(code),ref=doc(db,'experiences',exp,'attempts',id),snap=await getDoc(ref),removed=snap.data();await deleteDoc(ref);if(removed?.teamId){const rest=await getDocs(query(collection(db,'experiences',exp,'attempts'),where('teamId','==',removed.teamId))),scores=rest.docs.map(d=>d.data()).filter(x=>Number.isFinite(x.score)),best=scores.sort((a,b)=>a.score-b.score)[0];await setDoc(doc(db,'experiences',exp,'teams',removed.teamId),{lastScore:best?.score??null,lastMetric:best?.metric??null,lastRound:best?.round??null,updatedAt:serverTimestamp()},{merge:true})}},
  control:(code,p)=>setDoc(doc(db,'experiences',normalizeCode(code)),{...p,code:String(code).trim(),updatedAt:serverTimestamp()},{merge:true})
 };
}
export const store={
 load:code=>enabled?api.load(code):Promise.resolve(demoRead(code)),
 join:async(code,t)=>{if(enabled)return api.join(code,t);const x=demoRead(code);if(!x?.active)throw new Error('Esta actividad no existe o todavía no ha comenzado.');const id=normalizeCode(t.name)||'equipo';return{...t,id,experienceId:normalizeCode(code)}},
 adminLogin:()=>enabled?api.adminLogin():Promise.resolve(),
 restoreAdmin:()=>enabled?api.restoreAdmin():Promise.resolve(true),
 save:async(code,team,p)=>{if(enabled)return api.save(code,team,p);const x=demoRead(code)||{},attempt={...p,id:`local-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,teamId:team.id,teamName:team.name,validated:false,createdAt:new Date().toISOString()};demoWrite(code,{attempts:[attempt,...(x.attempts||[])],teams:{...(x.teams||{}),[team.id]:{...team}}})},
 watchExp:(code,cb)=>{if(enabled)return api.watchExp(code,cb);const handler=e=>{if(e.detail.code===normalizeCode(code))cb(e.detail.data)};bus.addEventListener('change',handler);const storage=e=>{if(e.key===localKey(code))cb(demoRead(code))};addEventListener('storage',storage);cb(demoRead(code));return()=>{bus.removeEventListener('change',handler);removeEventListener('storage',storage)}},
 watchBoard:(code,cb)=>{if(enabled)return api.watchBoard(code,cb);const emit=()=>cb((demoRead(code)?.attempts||[]).filter(a=>a.validated===true));const handler=e=>{if(e.detail.code===normalizeCode(code))emit()};bus.addEventListener('change',handler);const storage=e=>{if(e.key===localKey(code))emit()};addEventListener('storage',storage);emit();return()=>{bus.removeEventListener('change',handler);removeEventListener('storage',storage)}},
 watchAttempts:(code,cb,onError)=>{if(enabled)return api.watchAttempts(code,cb,onError);const emit=()=>cb(demoRead(code)?.attempts||[]);const handler=e=>{if(e.detail.code===normalizeCode(code))emit()};bus.addEventListener('change',handler);const storage=e=>{if(e.key===localKey(code))emit()};addEventListener('storage',storage);emit();return()=>{bus.removeEventListener('change',handler);removeEventListener('storage',storage)}},
 listAttempts:code=>enabled?api.listAttempts(code):Promise.resolve(demoRead(code)?.attempts||[]),
 validateAttempt:async(code,id,validated)=>{if(enabled)return api.validateAttempt(code,id,validated);const x=demoRead(code)||{};demoWrite(code,{attempts:(x.attempts||[]).map(a=>a.id===id?{...a,validated,validatedAt:validated?new Date().toISOString():null}:a)})},
 deleteAttempt:async(code,id)=>{if(enabled)return api.deleteAttempt(code,id);const x=demoRead(code)||{},removed=(x.attempts||[]).find(a=>a.id===id),remaining=(x.attempts||[]).filter(a=>a.id!==id),teams={...(x.teams||{})};if(removed?.teamId&&teams[removed.teamId]){const best=remaining.filter(a=>a.teamId===removed.teamId).sort((a,b)=>a.score-b.score)[0];teams[removed.teamId]={...teams[removed.teamId],lastScore:best?.score??null,lastMetric:best?.metric??null,lastRound:best?.round??null}}demoWrite(code,{attempts:remaining,teams})},
 control:(code,p)=>enabled?api.control(code,p):Promise.resolve(demoWrite(code,p))
};
