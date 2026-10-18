// Exercise the actual Render All and queueOnce functions, with no ComfyUI/GPU.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ImageCarryRuntime, validateImageCarryQueue, prepareImageCarryGraph, captureId } from "../../web/experimental_image_carry.js";
const source=readFileSync(new URL("../../web/csglide_cast.js",import.meta.url),"utf8");
const render=source.slice(source.indexOf("  async function renderAll("),source.indexOf("  function switchTo(i)"));
const queueOnce=source.slice(source.indexOf("  async function queueOnce("),source.indexOf("  /* Polling rather than socket events:"));
const videoHistory=source.slice(source.indexOf("  function videoFromHistory("),source.indexOf("  function paintRun()"));
const state=()=>({mode:"ref2va",prompt:"Exact dialogue @audio1",length:73,cont:{file:"stale-cont.mkv"},slots:{images:[{file:"id.png"},{file:"room.png"},{file:"composition.png"}],videos:[{file:"stale-look.mkv",carry:true},{file:"stale-seam.mkv",seam:true},{}],audios:[{file:"voice.wav",start:1.25,end:4.25,dur:10}]}});
const make=()=>Array.from({length:3},(_,i)=>({id:`clip${i}`,name:`Clip ${i+1}`,link:i>0,state:state()}));
function harness(shots=make()) {
  return new Function("ImageCarryRuntime","validateImageCarryQueue","prepareImageCarryGraph","shots","captureId",`
    let st=JSON.parse(JSON.stringify(shots[0].state)),run=null;
    const p={shots,idx:0},node={id:1},imageCarryRuntime=new ImageCarryRuntime();
    const alerts=[],submitted=[],histories=new Map();let failAt=-1,missing=false,adoptions=0,seams=0;
    const proj=()=>p,stash=()=>{p.shots[p.idx].state=JSON.parse(JSON.stringify(st))};
    const scopeRange=(scope)=>scope==="clip"?[p.idx]:p.shots.map((_,i)=>i);
    const shotLabel=(s)=>s.name,paintRun=()=>{},snapProject=()=>{},commit=()=>{},render=()=>{},renderShots=()=>{};
    const presetSubsampled=()=>false,videoPresetName=()=>"FFV1";
    const clearRunContinuations=()=>{throw Error("Image mode must not invoke destructive continuation cleanup")};
    const switchTo=(i)=>{stash();p.idx=i;st=JSON.parse(JSON.stringify(p.shots[i].state))};
    const alert=(message)=>alerts.push(message),confirm=()=>true;
    const tailWindow=()=>({start:0,end:1});
    const adoptInto=async(slot)=>{adoptions++;slot.file="adopted.mkv"};
    const carrySeamRef=async()=>{seams++};const applySmartSpan=async()=>null;
    const PREVIEW_RE=/(^|[._-])preview\\.[^.]+$/i,VIDEO_OUT_RE=/\\.(mp4|mkv)$/i;
    const app={graphToPrompt:async()=>({workflow:{nodes:[]},output:{
      "1":{class_type:"CSGlideCastCS",inputs:{h3_data:JSON.stringify(st)}},
      "2":{class_type:"KSampler",inputs:{positive:["1",0]}},
      "3":{class_type:"VAEDecode",inputs:{samples:["2",0]}},
      "4":{class_type:"CSGlideJoinCS",inputs:{images:["3",0],source_video:["1",7],overlap_frames:["1",6]}},
      "5":{class_type:"CSGlideVideoCS",inputs:{images:["4",0]}}
    }})};
    const api={fetchApi:async()=>({ok:!missing}),queuePrompt:async(_,graph)=>{
      const id=String(submitted.length);submitted.push(graph);
      if(submitted.length===failAt)throw Error("simulated render failure");
      const capture=graph.output[captureId(1)];
      const outputs={"5":{gifs:[{filename:"clip"+id+".mkv",type:"output"}]}};
      if(capture)outputs[captureId(1)]={cglide_image_carry:[{filename:capture.inputs.run_token+".png",subfolder:"cglide-image-carry",type:"temp",version:capture.inputs.run_token}]};
      histories.set(id,{outputs});return {prompt_id:id};
    }};
    const waitForPrompt=async(id)=>histories.get(id);
    ${queueOnce}
    ${videoHistory}
    ${render}
    return {p,alerts,submitted,runtime:imageCarryRuntime,
      async render(image=true,scope="all",look=true){await renderAll(scope,look,false,image);return {adoptions,seams}},
      select(i){switchTo(i)},fail(n){failAt=n},missing(value){missing=value}};
  `)(ImageCarryRuntime,validateImageCarryQueue,prepareImageCarryGraph,shots,captureId);
}

test("actual Render All performs sequential raw image handoffs with no video adoption or project mutation",async()=>{
 const shots=make().slice(0,2),before=shots.map(s=>JSON.stringify(s.state));const h=harness(shots);
 const stats=await h.render();assert.equal(h.alerts.length,0);assert.equal(h.submitted.length,2);
 assert.deepEqual(stats,{adoptions:0,seams:0});
 const first=JSON.parse(h.submitted[0].output["1"].inputs.h3_data),next=JSON.parse(h.submitted[1].output["1"].inputs.h3_data);
 assert.equal(first.prompt,"Exact dialogue @audio1");assert.ok(next.prompt.includes("@image4"));
 assert.deepEqual(next.cont,{});assert.ok(next.slots.videos.every(s=>!s.file));assert.equal(next.slots.audios[0].start,1.25);
 assert.deepEqual(shots.map(s=>JSON.stringify(s.state)),before);assert.ok(h.runtime.frameFor(shots[1]));
});
test("failed second clip keeps first capture and can resume this clip without stale references",async()=>{
 const h=harness(make().slice(0,2));h.fail(2);await h.render();assert.equal(h.alerts.length,1);
 assert.ok(h.runtime.frameFor(h.p.shots[0]));assert.equal(h.runtime.frameFor(h.p.shots[1]),null);
 h.fail(-1);h.select(1);await h.render(true,"clip");assert.equal(h.submitted.length,3);assert.ok(h.runtime.frameFor(h.p.shots[1]));
 const failed=JSON.parse(h.submitted[1].output["1"].inputs.h3_data),resumed=JSON.parse(h.submitted[2].output["1"].inputs.h3_data);
 assert.equal(resumed.prompt,failed.prompt);assert.equal(resumed.slots.images.length,4);
});
test("missing predecessor/session restart and missing temp asset refuse before queue",async()=>{
 const h=harness();h.select(1);await h.render(true,"clip");assert.equal(h.submitted.length,0);assert.match(h.alerts[0],/Include\/re-render/);
 const other=harness();other.p.shots[1].off=true;other.p.shots[2].off=true;await other.render();other.select(1);other.missing(true);await other.render(true,"clip");
 assert.equal(other.submitted.length,1);assert.match(other.alerts.at(-1),/temporary frame is missing/);
});
test("all clip image capacities are validated before the first queue",async()=>{
 const shots=make();shots[2].state.slots.images=Array.from({length:9},()=>({file:"used.png"}));
 const h=harness(shots);await h.render();assert.equal(h.submitted.length,0);assert.match(h.alerts[0],/free image-reference/);
});
test("normal linked rendering still takes video tails and seam references without capture injection",async()=>{
 const h=harness(make().slice(0,2));const stats=await h.render(false,"all",false);
 assert.equal(h.alerts.length,0);assert.equal(stats.adoptions,1);assert.equal(stats.seams,1);
 assert.ok(h.submitted.every(g=>!g.output[captureId(1)]));
});
test("normal unlinked Look At and independent rendering retain their prior paths",async()=>{
 const shots=make().slice(0,2);shots.forEach(s=>s.link=false);const look=harness(shots);
 const stats=await look.render(false,"all",true);assert.equal(stats.adoptions,1);assert.equal(stats.seams,0);assert.equal(look.alerts.length,0);
 const independent=harness(make().slice(0,1));const plain=await independent.render(false,"all",false);
 assert.deepEqual(plain,{adoptions:0,seams:0});assert.equal(independent.alerts.length,0);
});

test("external execution invalidates idle session captures, while an active project run keeps its captures",()=>{
 const start=source.indexOf("  const invalidateExternalImageCarry = () => {");
 const end=source.indexOf('  api.addEventListener("execution_start", invalidateExternalImageCarry);',start);
 const callback=source.slice(start,end);
 const p={shots:[{}]};let count=0;const runtime={invalidate:(shots)=>{assert.equal(shots,p.shots);count++}};
 const make=new Function("imageCarryRuntime","proj","run",callback+";return invalidateExternalImageCarry");
 make(runtime,()=>p,null)();assert.equal(count,1);
 make(runtime,()=>p,{})();assert.equal(count,1);
});
