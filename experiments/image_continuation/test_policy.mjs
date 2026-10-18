import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prepareImageCarryState, prepareImageCarryGraph, rawCaptureLink, ImageCarryRuntime, captureId } from "../../web/experimental_image_carry.js";

const nonce = "12345678-1234-1234-1234-123456789abc";
const frame = { filename: `${nonce}.png`, subfolder: "cglide-image-carry", type: "temp", version: nonce };
const state = () => ({mode:"ref2va", prompt:"summary: Talking head\ndetailed_description: Exact spoken dialogue @audio1\n", length:73,
  cont:{file:"previous.mkv"}, slots:{images:[{file:"identity.png"},{file:"room.png"},{file:"composition.png"}],
    videos:[{file:"old-look.mkv",carry:true},{file:"old-seam.mkv",seam:true},{}],
    audios:[{file:"dialogue.wav",start:3.125,end:6.25,dur:20}]}});
const graph = () => ({output:{
  "1":{class_type:"CSGlideCastCS",inputs:{h3_data:JSON.stringify(state())}},
  "2":{class_type:"KSampler",inputs:{positive:["1",0],latent_image:["1",1],seed:42}},
  "3":{class_type:"VAEDecode",inputs:{samples:["2",0],vae:["99",0]}},
  "4":{class_type:"CSGlideJoinCS",inputs:{images:["3",0],source_video:["1",7],overlap_frames:["1",6],match_levels:true}},
  "5":{class_type:"CSGlideVideoCS",inputs:{images:["4",0],audio:["4",1]}}
},workflow:{nodes:[{id:1,properties:{keep:true}}]}});

test("runtime draft preserves authored prompt, references, settings and audio byte-for-byte",()=>{
 const source=state(), before=JSON.stringify(source);const draft=prepareImageCarryState(source,frame);
 assert.equal(JSON.stringify(source),before);assert.deepEqual(draft.slots.images.slice(0,3),source.slots.images);
 assert.equal(draft.slots.images[3].file,`${frame.subfolder}/${frame.filename} [temp]`);
 assert.ok(draft.prompt.startsWith("Image Carry guidance: use @image4"));assert.ok(draft.prompt.endsWith(source.prompt));
 assert.ok(draft.prompt.includes("\n\nsummary:"));assert.equal(draft.prompt.split("Image Carry guidance:").length,2);
 assert.deepEqual(draft.slots.audios,source.slots.audios);assert.deepEqual(draft.cont,{});
 assert.ok(draft.slots.videos.every(s=>!s.file));assert.equal(draft.length,73);
});
test("first project clip gets no injected image or prompt",()=>{
 const source=state();const draft=prepareImageCarryState(source,null);
 assert.deepEqual(draft.slots.images,source.slots.images);assert.equal(draft.prompt,source.prompt);assert.deepEqual(draft.cont,{});
});
test("sparse slots choose actual first free slot and never reorder user images",()=>{
 const source=state();source.slots.images=[{file:"identity.png"},{},{file:"room.png"},{file:"wardrobe.png"}];
 const draft=prepareImageCarryState(source,frame);assert.ok(draft.prompt.includes("use @image2"));
 assert.equal(draft.slots.images[2].file,"room.png");assert.equal(draft.slots.images[3].file,"wardrobe.png");
});
test("rejects wrong modes, full image capacity, manual videos, conflicting empty-slot tokens and invalid assets",()=>{
 let source=state();source.mode="fl2va";assert.throws(()=>prepareImageCarryState(source,frame),/REF2VA/);
 source=state();source.slots.images=Array.from({length:9},()=>({file:"used.png"}));assert.throws(()=>prepareImageCarryState(source,frame),/free image/);
 source=state();source.slots.videos[1]={file:"manual.mp4",audio:true};assert.throws(()=>prepareImageCarryState(source,frame),/manual video/);
 source=state();source.prompt+=" @image4 ";assert.throws(()=>prepareImageCarryState(source,frame),/already mentions/);
 assert.throws(()=>prepareImageCarryState(state(),{...frame,filename:"../../outside.png"}),/invalid capture/);
});
test("cloned API prompt captures raw decoder, preserves workflow and sampling configuration",()=>{
 const original=graph(), before=JSON.stringify(original);const draft=prepareImageCarryGraph(original,1,frame,nonce);
 assert.equal(JSON.stringify(original),before);assert.deepEqual(draft.workflow,original.workflow);
 assert.deepEqual(draft.output[captureId(1)].inputs,{images:["3",0],run_token:nonce});
 assert.deepEqual(draft.output["2"],original.output["2"]);assert.deepEqual(draft.output["4"],original.output["4"]);
 assert.equal(JSON.parse(draft.output["1"].inputs.h3_data).imageCarryRevision,nonce);
});
test("supports direct raw decoder to Glide Video when Join is absent",()=>{
 const source=graph();delete source.output["4"];source.output["5"].inputs.images=["3",0];
 assert.deepEqual(rawCaptureLink(source.output,1),{images:["3",0],videoId:"5"});
});
test("rejects assembled/postprocessed, ambiguous, disconnected and incorrectly wired raw provenance",()=>{
 let source=graph();source.output["4"].inputs.images=["20",0];source.output["20"]={class_type:"ColorMatch",inputs:{images:["3",0]}};
 assert.throws(()=>rawCaptureLink(source.output,1),/stock VAEDecode/);
 source=graph();source.output["6"]={class_type:"CSGlideCastCS",inputs:{}};assert.throws(()=>rawCaptureLink(source.output,1),/exactly one/);
 source=graph();source.output["6"]=source.output["5"];assert.throws(()=>rawCaptureLink(source.output,1),/unambiguous/);
 source=graph();source.output["3"].inputs.samples=["100",0];assert.throws(()=>rawCaptureLink(source.output,1),/not connected/);
 source=graph();source.output["4"].inputs.overlap_frames=22;assert.throws(()=>rawCaptureLink(source.output,1),/overlap_frames/);
});
test("session records accept only matching capture nonce and output identity",()=>{
 const runtime=new ImageCarryRuntime();const shot={lastOut:{name:"a.mkv"}};
 const entry={outputs:{[captureId(1)]:{cglide_image_carry:[frame]}}};
 runtime.record(shot,entry,1,nonce);assert.deepEqual(runtime.frameFor(shot),frame);
 shot.lastOut={name:"rerender.mkv"};assert.equal(runtime.frameFor(shot),null);
 assert.throws(()=>runtime.record(shot,entry,1,"00000000-0000-0000-0000-000000000000"),/expected raw final frame/);
 assert.equal(new ImageCarryRuntime().frameFor(shot),null);
});
test("rerenders invalidate current and dependent captures while preserving previous clips",()=>{
 const runtime=new ImageCarryRuntime();const shots=[{lastOut:{name:"a"}},{lastOut:{name:"b"}},{lastOut:{name:"c"}}];
 const entry={outputs:{[captureId(1)]:{cglide_image_carry:[frame]}}};
 for(const shot of shots)runtime.record(shot,entry,1,nonce);
 runtime.invalidate(shots.slice(1));assert.ok(runtime.frameFor(shots[0]));assert.equal(runtime.frameFor(shots[1]),null);assert.equal(runtime.frameFor(shots[2]),null);
});
test("old/new failed attempts cannot share a capture asset or conditioning identity",()=>{
 const other="abcdefab-abcd-abcd-abcd-abcdefabcdef";
 const a=prepareImageCarryGraph(graph(),1,frame,nonce);
 const b=prepareImageCarryGraph(graph(),1,{...frame,filename:`${other}.png`,version:other},other);
 assert.notEqual(a.output["1"].inputs.h3_data,b.output["1"].inputs.h3_data);
 assert.notEqual(a.output[captureId(1)].inputs.run_token,b.output[captureId(1)].inputs.run_token);
});
test("example workflow raw decode/Join/Studio sockets match supported graph contract",()=>{
 const workflow=JSON.parse(readFileSync(new URL("../../example_workflows/Minimax_h3_Studio_Lat_Uscl_CK_8.json",import.meta.url)));
 const node=workflow.nodes.find(n=>n.type==="CSGlideJoinCS");
 const find=(name)=>workflow.links.find(l=>l[0]===node.inputs.find(i=>i.name===name).link);
 const raw=find("images"),source=find("source_video"),overlap=find("overlap_frames");
 assert.equal(workflow.nodes.find(n=>n.id===raw[1]).type,"VAEDecode");
 assert.equal(source[2],7);assert.equal(overlap[2],6);assert.equal(source[1],overlap[1]);
});

test("authored video-directed instructions are refused instead of silently losing their conditioning",()=>{
 const source=state();source.prompt+=" use @videoaudio1 and @video1";
 assert.throws(()=>prepareImageCarryState(source,frame),/video-directed prompt/);
});
