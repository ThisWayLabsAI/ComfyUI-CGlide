// CPU-only checks of the actual merged state and render functions.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../web/csglide_cast.js',import.meta.url),'utf8');
const part=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const stateCode=part('const alignFrames =','/* Same ordinal rules');
const {parseInitial}=new Function('MAX_IMAGES','MAX_VIDEOS','MAX_AUDIOS',stateCode+';return {parseInitial};')(9,3,3);
const base=()=>parseInitial({prompt:'Authored @image1',audio_mode:'timeline',slots:{images:[{file:'identity.png'}],audios:[{file:'speech.wav',dur:8,start:1,end:6,at:2,hold:.8}]},cont:{file:'old.mkv',origin:{name:'old.mkv',subfolder:'project',type:'output'}}});

test('state round trips preserve timeline placement, hold and latent-sidecar origin',()=>{
 const a=base();assert.deepEqual(parseInitial(JSON.stringify(a)),a);
 assert.equal(a.audio_mode,'timeline');assert.equal(a.slots.audios[0].at,2);assert.equal(a.slots.audios[0].hold,.8);
 assert.equal(a.cont.origin.subfolder,'project');
});

test('workspace timeline timing validates the entire request before mutation',()=>{
 const st=base();const refCode=part('  function referenceSlot(','  const referenceEditingV1 =');
 const h=new Function('st',`const MAX_IMAGES=9,MAX_VIDEOS=3,MAX_AUDIOS=3;let run=null;const audioPlaced=s=>s.mode==='fl2va'||s.audio_mode==='timeline';const render=()=>{},commit=()=>{},stash=()=>{},projectWorkspaceSnapshot=()=>structuredClone(st);${refCode};return {updateWorkspaceTimedReference,referenceSlot,setWorkspaceAudioMode};`)(st);
 const req={version:1,kind:'audio',index:0,expectedFile:'speech.wav',start:2,end:5,at:3,hold:.6};
 const before=JSON.stringify(st);assert.throws(()=>h.updateWorkspaceTimedReference({...req,hold:2}),/hold/);assert.equal(JSON.stringify(st),before);
 h.updateWorkspaceTimedReference(req);assert.equal(st.slots.audios[0].at,3);assert.equal(st.slots.audios[0].hold,.6);
 assert.equal(h.referenceSlot('audio',0).token,null);h.setWorkspaceAudioMode({version:1,mode:'ref'});assert.equal(h.referenceSlot('audio',0).token,'@audio1');
 st.mode='fl2va';assert.equal(h.referenceSlot('audio',0).token,null);assert.throws(()=>h.referenceSlot('video',0),/require/);
});

function harness({upscale=false}={}){
 const shots=[0,1,2].map(i=>({id:'s'+i,name:'Clip '+i,link:i>0,state:base(),lastOut:{name:'old'+i+'.mkv',subfolder:'project'}}));
 const cleanup=part('  function clearContinuationState(','  function toggleLink(');
 const renderCode=part('  async function renderAll(','  function switchTo(i)');
 return new Function('shots','upscale',`
 let st=structuredClone(shots[0].state),run=null;const p={shots,idx:0},node={id:1,properties:{}};
 const storage=new Map(),sessionStorage={setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k),removeItem:k=>storage.delete(k)};
 const window={__h3RunOwner:{}},app={graph:{getNodeById:()=>node}};
 const clone=v=>structuredClone(v),uid=()=>String(Math.random()),proj=()=>p;
 const stash=()=>{p.shots[p.idx].state=clone(st)},load=s=>{st=JSON.parse(s)};
 const render=()=>{},commit=()=>{},renderShots=()=>{},paintRun=()=>{},snapProject=()=>{};
 const scopeRange=scope=>scope==='clip'?[p.idx]:[0,1,2];
 const upscaleOn=()=>upscale,presetSubsampled=()=>false,videoPresetName=()=>'',shotLabel=s=>s.name;
 const alerts=[],prepared=[],queued=[],waited=[];const alert=m=>alerts.push(m),confirm=()=>true;
 const overlapFrames=()=>39,tailWindow=(dur,frames)=>({start:dur-frames/24,end:dur});
 const clearSlot=s=>{Object.keys(s).forEach(k=>delete s[k])};
 const adoptInto=async(slot,pick)=>{prepared.push(pick.name);slot.file=pick.name;slot.dur=10;slot.origin=clone(pick)};
 const carrySeamRef=async()=>{},applySmartSpan=async()=>null;
 const switchTo=i=>{stash();p.idx=i;st=clone(p.shots[i].state)};
 const queueOnce=async()=>{const id='new'+queued.length;queued.push(clone(st));return id};
 const waitForPrompt=async id=>{waited.push(id);return {id}};
 const videoFromHistory=entry=>({name:entry.id+'.mkv',subfolder:'project',type:'output'});
 ${cleanup}
 ${renderCode}
 return {p,node,queued,waited,prepared,alerts,storage,renderAll,runLoop,select:switchTo,edit:fn=>fn(st)};
 `)(shots,upscale);
}

test('clear continues preserves manual references, rebuilds linked tails at the selected overlap, and completes the resumable loop',async()=>{
 const h=harness();h.edit(st=>{st.slots.videos[0]={file:'manual.mp4'}});
 await h.renderAll('all',false,true);
 assert.equal(h.alerts.length,0);assert.equal(h.queued.length,3);
 assert.equal(h.queued[0].slots.videos[0].file,'manual.mp4');assert.deepEqual(h.queued[0].cont,{});
 assert.equal(h.queued[1].cont.file,'new0.mkv');assert.ok(Math.abs(h.queued[1].cont.end-h.queued[1].cont.start-39/24)<1e-8);
 assert.equal(h.p.shots[2].lastOut.name,'new2.mkv');assert.equal(h.node.properties.gcast_run,undefined);assert.equal(h.p.idx,0);
});

test('resuming an already queued clip waits for its existing prompt instead of adopting or queuing again',async()=>{
 const h=harness();await h.runLoop({id:'resume',queue:[1],k:0,promptId:'pending',scope:'clip',startIdx:0,made:[],look:false},true);
 assert.equal(h.alerts.length,0);assert.deepEqual(h.waited,['pending']);assert.equal(h.queued.length,0);assert.equal(h.prepared.length,0);
 assert.equal(h.p.shots[1].lastOut.name,'pending.mkv');
});

test('upscale pass does not clear the draft renders required to load full latents',async()=>{
 const h=harness({upscale:true});await h.renderAll('all',false,true);
 assert.equal(h.alerts.length,0);assert.equal(h.prepared.length,0);
 assert.equal(h.p.shots[0].lastOut.name,'old0.mkv');assert.equal(h.p.shots[0].lastUp.name,'new0.mkv');
});
