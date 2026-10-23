import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../web/csglide_cast.js',import.meta.url),'utf8');
const part=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const {parseInitial}=new Function('MAX_IMAGES','MAX_VIDEOS','MAX_AUDIOS',part('const alignFrames =','/* Same ordinal rules')+';return {parseInitial};')(9,3,3);
function harness(){
 const code=part('  function projectCreationSnapshot()', '  const projectNavigationV1 =');
 const revert=part('  function revertProject()', '  /* Autosave.');
 return new Function('parseInitial',`
 const clone=x=>JSON.parse(JSON.stringify(x)); const FPS=24,MAX_PIXELS=1000000,snap=x=>x;
 let st=parseInitial({width:800,height:448,prompt:'unsaved',length:56,slots:{images:[{file:'id.png'}]}});
 const old={name:'Old',idx:0,shots:[{id:'old',name:'Old clip',state:clone(st),lastOut:{name:'out.mkv'}}],song:{file:'song.wav',start:3}};
 const node={properties:{gcast_project:old},inputs:[{name:'audio_vae',link:1}],outputs:[{name:'locked_audio',links:[2]}],
 graph:{links:{2:{target_id:8,target_slot:0}},getNodeById:()=>({type:'CSGlideJoinCS',inputs:[{name:'locked_audio'}]})}};
 let run=null,overlap=22,backupCount=0,projHandle='old',projLabel='old',serial=0;
 const settings=()=>({seamRef:false}),latentHoldOn=()=>true,overlapFrames=()=>overlap,songOf=()=>node.properties.gcast_project.song||null;
 const projectWorkspaceSnapshot=()=>({activeState:clone(st),clips:clone(node.properties.gcast_project.shots)});
 const uid=()=>String(++serial),proj=()=>node.properties.gcast_project;
 const stash=()=>{const p=proj();if(p.shots[p.idx])p.shots[p.idx].state=clone(st);};
 const seedFromScreen=p=>{if(!p.shots.length){p.shots=[{id:'screen',state:clone(st)}];p.idx=0;}};
 const projSnapshot=()=>{const p=proj();return {name:p.name,idx:p.idx,shots:clone(p.shots),timing:clone(p.timing||null)};};
 const snapProject=why=>{backupCount++;node.properties.gcast_project_prev={...projSnapshot(),why};};
 const load=raw=>{st=JSON.parse(raw);};const commit=()=>{},paintShotsBtn=()=>{},paintPresetName=()=>{},renderShots=()=>{},paintTimeline=()=>{};
 const prevProject=()=>node.properties.gcast_project_prev,confirm=()=>true,prevWhen=()=>'';
 ${code}\n${revert}
 return {node,snapshot:projectCreationSnapshot,create:createProjectFromClips,revert:revertProject,
 setRun:x=>run=x,setOverlap:x=>overlap=x,backups:()=>backupCount,clear:()=>{node.properties.gcast_project={name:'',idx:-1,shots:[]};},parseInitial};`)(parseInitial);
}
function request(h){return {version:1,name:'Dialogue',maximumSeconds:8,requireLockedAudio:true,allowSeamReferences:false,expectedSnapshot:JSON.stringify(h.snapshot()),
 clips:[0,1,2].map(i=>({name:'Speech '+i,link:i>0,state:parseInitial({width:800,height:448,length:192,prompt:'exact dialogue',audio_mode:'timeline',slots:{audios:[{file:'speech.wav',dur:24,start:i*7,end:i*7+8,at:0,hold:1}]}})}))};}
test('atomic creation assigns clean IDs and links, respects frame ceiling, and reverts song and unsaved state',()=>{
 const h=harness(),before=structuredClone(h.node.properties.gcast_project);h.create(request(h));
 const p=h.node.properties.gcast_project;assert.equal(p.name,'Dialogue');assert.equal(p.song,undefined);assert.equal(h.backups(),1);
 assert.deepEqual(p.shots.map(s=>s.link),[false,true,true]);assert.equal(new Set(p.shots.map(s=>s.id)).size,3);
 assert.ok(p.shots.every(s=>!s.lastOut && !s.state.cont.file && s.state.length<=192));
 h.revert();assert.deepEqual(h.node.properties.gcast_project,before);h.revert();assert.equal(h.node.properties.gcast_project.name,'Dialogue');assert.equal(h.node.properties.gcast_project.timing.overlapFrames,22);assert.equal(h.node.properties.gcast_project.song,undefined);
});
test('invalid final clip, running render, stale source, song, overlap and wiring cause no mutation or backup',()=>{
 for(const mutate of [
 (h,r)=>r.clips[2].state.length=209,
 (h,r)=>r.clips[2].state.slots.audios[0].end=99,
 (h,r)=>h.setRun({}),
 (h,r)=>h.setOverlap(39),
 (h,r)=>h.node.properties.gcast_project.song.start=4,
 (h,r)=>h.node.inputs[0].link=null,
 (h,r)=>h.node.graph.links[2].target_id=9,
 (h,r)=>r.clips[2].state.cont={file:'stale.mp4'},
 ]){
 const h=harness(),r=request(h);mutate(h,r);const before=JSON.stringify(h.node.properties);assert.throws(()=>h.create(r));assert.equal(JSON.stringify(h.node.properties),before);assert.equal(h.backups(),0);
 }
});
test('missing graph fails even with a fresh preview; empty projects back up the visible clip',()=>{
 const h=harness();h.node.outputs[0].links=[];assert.throws(()=>h.create(request(h)),/Connect/);assert.equal(h.backups(),0);
 const e=harness();e.clear();e.create(request(e));assert.equal(e.node.properties.gcast_project_prev.shots[0].state.prompt,'unsaved');
});

test('saved clock overrides workflow defaults and native export retains validated timing',async()=>{
 const cleanCode=part('  function cleanProjectTiming(', '  function projectCreationSnapshot()');
 const clean=new Function('FPS',cleanCode+';return cleanProjectTiming;')(24);
 assert.equal(clean(null),null);assert.throws(()=>clean({version:1,fps:30,overlapFrames:22}),/Unsupported/);
 for(const overlap of [22,39]){
 const timing=clean({version:1,fps:24,overlapFrames:overlap});
 const node={properties:{gcast_settings:{overlap:overlap===22?39:22},gcast_project:{timing}}};
 const actualOverlap=new Function('node','FPS',part('  const overlapFrames = () => {','  const songSnap =')+';return overlapFrames;')(node,24);
 assert.equal(actualOverlap(),overlap);
 const project={name:'saved',idx:0,shots:[],timing};
 const blob=new Function('proj',part('  function projectBlob()', '  async function saveProject(')+';return projectBlob();')(()=>project);
 assert.deepEqual(JSON.parse(await blob.text()).timing,timing);
 }
});
