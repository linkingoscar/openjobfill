const { waitForCompletedRun } = require('./browser-assertions.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
module.exports = async function verifySelectBehavior(context, options, url, artifactDir) {
 const scenarios = [
  ...['portal-scope','hidden-duplicate','disabled-duplicate','async-search','late-popup-association','idref-list','legacy-select2'].map(name=>({name,expected:'target'})),
  {name:'native-disabled',expected:'native'},
  {name:'cascader-async',expected:'广东省/深圳市',location:{province:'广东省',city:'深圳市'}},
  {name:'cascader-columns',expected:'其他/其他',location:{province:'其他',city:'其他'}},
 ];
 for(const scenario of scenarios) {
  await options.evaluate(async ({location,name})=>{
   const key='openjobfill_resume_resume-default';const resume=(await chrome.storage.local.get(key))[key];
   resume.educations=[{id:'synthetic-school',schoolName:name==='legacy-select2'?'清华大学':'测试大学',degree:'本科',major:'软件工程',startDate:'2024-09',endDate:'2027-06'}];
   resume.basics.currentLocation=location||{province:'广东省',city:'深圳市'};resume.updatedAt=Date.now();
   await chrome.storage.local.set({[key]:resume});await chrome.storage.local.remove('openjobfill_replay_snapshots');
  },scenario);
  const startedAt=await options.evaluate(()=>Date.now());
  const page=await context.newPage();await page.setViewportSize({width:1366,height:1000});
  await page.goto(`${url}/test/fixtures/select-behavior.html?case=${scenario.name}`);
  await page.evaluate(({name})=>{
   document.querySelector('#case-picker').remove();
   const label=document.querySelector('#fixture label');
   if(name.startsWith('cascader'))label.textContent='现居住地';
  },scenario);
  const host=page.locator('#openjobfill-extension-host');
  await host.locator('button[aria-label^="一键自动填写当前页面"]').click();
  const confirm=host.getByRole('button',{name:/^确认填写/});await confirm.waitFor({timeout:15000});await confirm.click();
  const results=await waitForCompletedRun(options,startedAt,'/select-behavior.html');
  await page.screenshot({path:path.join(artifactDir,`select-${scenario.name}.png`),fullPage:true});
  const state=await page.evaluate(()=>window.selectBehaviorFixture.state);
  if(scenario.expected==='native')assert.equal(await page.locator('#audited-control').inputValue(),'target');
  else assert.equal(state.committed,scenario.expected,`${scenario.name} committed state: ${JSON.stringify(state)}`);

  assert.ok(results.some(result=>result.verifiedCount>0),`${scenario.name} must pass production readback: ${JSON.stringify(results)}`);
  await page.close();
 }
 console.log('select behavior passed: portals, hidden/disabled entries, async search, dynamic association, legacy Select2 and cascader child loading');
};
