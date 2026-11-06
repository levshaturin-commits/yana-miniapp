const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const cp=require('node:child_process');
const {interpret}=require('../second-test-engine.js');
const c=require('../second-test-content.js');
test('legacy script, styles and full first-test markup unchanged (normalize Git line endings)',()=>{
  const before=cp.execFileSync('git',['show','19cf6a7:index.html'],{encoding:'utf8'});
  const after=fs.readFileSync('index.html','utf8').replace(/\r\n/g,'\n');
  for(const pattern of [/<style>[\s\S]*?<\/style>/, /<script>[\s\S]*?<\/script>/, /<main class="app">[\s\S]*?<\/main>/]) assert.equal(after.match(pattern)[0],before.match(pattern)[0]);
});
test('reject missing, invalid and sparse answers',()=>{
  for(const a of [null,[],Array(10),Array(10).fill('E'),Array(9).fill('A'),[...Array(9).fill('A'),null]]) assert.throws(()=>interpret(a));
});
test('specified financial, ideas, existing evidence and low-time cases',()=>{
  const cases=[['BBACAAADAB',['R01','R07']],['CCCBBCBCDB',['R06']],['DDBDCDDADC',[]],['AAD CDBCBBD'.replace(/ /g,''),['R02']]];
  for(const [answers,rules] of cases) assert.deepEqual(interpret([...answers]).ruleIds,rules);
  const paid=interpret([...'DDBDCDDADC']).sections[3].paragraphs[0];
  assert.ok(paid.startsWith(c.proofAction.A));
  assert.ok(interpret([...'BBACAAADAB']).sections[3].paragraphs.join(' ').includes(c.constraintAction.A));
});
test('each of ten independent axes changes output',()=>{
  const base=Array(10).fill('D');
  for(let i=0;i<10;i++) {const changed=[...base];changed[i]='A';assert.notDeepEqual(interpret(base).sections,interpret(changed).sections);}
});
test('all 1,048,576 combinations: complete, deterministic assembly and priority/category rules',()=>{
  const a=Array(10).fill('A');
  for(let n=0;n<4**10;n++) {
    let value=n;for(let i=0;i<10;i++){a[i]='ABCD'[value%4];value=Math.floor(value/4);}
    const r=interpret(a);
    assert.equal(r.sections.length,4);
    for(const s of r.sections) {assert.ok(s.title);assert.ok(s.paragraphs.length>0);for(const p of s.paragraphs){assert.ok(p.length>20);assert.ok(!p.includes('undefined'));}}
    assert.equal(r.sections[1].paragraphs[0],`${c.strengthInterest[a[2]+a[3]]} ${c.demandEvidence[a[7]]}`);
    assert.equal(r.sections[3].paragraphs[1],`${c.constraintAction[a[8]]} ${c.behaviorAction[a[6]]}`);
    const expected=[];const seen=new Set();
    for(const rule of c.rules) if(rule.conditions.every(([i,v])=>a[i]===v)&&!seen.has(rule.category)&&expected.length<2){expected.push(rule.id);seen.add(rule.category);}
    assert.deepEqual(r.ruleIds,expected);
    if(n%1024===0) assert.deepEqual(r,interpret(a));
  }
});
