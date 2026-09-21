import assert from 'node:assert/strict';
import {runUploadBatch,type UploadItem} from '../lib/upload-batch.ts';
const items:UploadItem[]=['one.pdf','bad.pdf','three.pptx','same.pdf'].map((name,i)=>({id:String(i),file:new File(['fixture'],name),courseId:'captured-course',courseName:'Original course',status:'waiting'}));
let active=0,maximum=0;const calls:string[]=[];const updates:UploadItem[][]=[];
const first=await runUploadBatch(items,async item=>{active++;maximum=Math.max(maximum,active);calls.push(item.file.name);assert.equal(item.courseId,'captured-course');await Promise.resolve();active--;if(item.file.name==='bad.pdf')throw new Error('Document illisible');return {duplicate:item.file.name==='same.pdf'}},state=>updates.push(state));
assert.equal(maximum,1);assert.deepEqual(calls,items.map(x=>x.file.name));assert.deepEqual(first.map(x=>x.status),['saved','error','saved','duplicate']);assert.equal(first[1].message,'Document illisible');assert.ok(items.every(x=>x.status==='waiting'));assert.equal(updates[0][0].status,'uploading');assert.equal(updates[0][1].status,'waiting');
const retryCalls:string[]=[];const retried=await runUploadBatch(first,async item=>{retryCalls.push(item.file.name);return {}},()=>{});assert.deepEqual(retryCalls,['bad.pdf']);assert.deepEqual(retried.map(x=>x.status),['saved','saved','saved','duplicate']);assert.equal(retried[1].message,undefined);
console.log('PASS: serial processing, continued uploads after failure, per-file results, fixed course destination, duplicate status, retry only failures, immutable progress snapshots.');
