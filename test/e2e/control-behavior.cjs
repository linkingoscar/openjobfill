const { waitForCompletedRun } = require('./browser-assertions.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
module.exports = async function verifyControlBehavior(context, options, url, artifactDir) {
 await options.evaluate(async () => {
  const key='openjobfill_resume_resume-default'; const resume=(await chrome.storage.local.get(key))[key];
  Object.assign(resume.basics,{name:'Synthetic Candidate',email:'synthetic@example.com',gender:'男',birthDate:'2001-05-18',acceptOvertime:true,selfEvaluation:'Synthetic description for local testing only'});
  resume.updatedAt=Date.now(); await chrome.storage.local.set({[key]:resume});
 });
 for(const mode of ['vue','cancel','rerender','invalid','radio','checkbox','calendar','debounced','cancel-main']) {
  console.log(`control scenario: ${mode}`);
  const startedAt = await options.evaluate(() => Date.now());
  const page=await context.newPage(); await page.setViewportSize({width:1366,height:1000});
  await page.goto(`${url}/apply/text-date-behavior.html?case=${mode}`);
  const host=page.locator('#openjobfill-extension-host');
  await host.locator('button[aria-label^="一键自动填写当前页面"]').click();
  const confirm=host.getByRole('button',{name:/^确认填写/});await confirm.waitFor({timeout:15000});await confirm.click();
  const results=await waitForCompletedRun(options,startedAt,'/text-date-behavior.html');
  await page.screenshot({path:path.join(artifactDir,`controls-${mode}.png`),fullPage:true});
  if(mode==='vue') {
   const model=JSON.parse(await page.locator('#model').textContent());
   assert.equal(model.candidateName,'Synthetic Candidate');assert.equal(model.email,'synthetic@example.com');assert.equal(model.gender,'男');assert.equal(model.birthDate,'2001-05-18');assert.equal(model.acceptOvertime,true);assert.equal(model.summary,'Synthetic description for local testing only');
  } else if(mode==='calendar') { assert.equal(await page.evaluate(()=>window.committedDate),'2001-05-18'); }
  else if(mode==='radio')assert.equal(await page.locator('input:checked').inputValue(),'男');
  else if(mode==='checkbox')assert.equal(await page.locator('input').isChecked(),false);
  else if(mode==='cancel-main'||mode==='cancel'||mode==='rerender'||mode==='debounced')assert.equal(await page.locator('#name').inputValue(),'');
  if(['cancel','rerender','invalid','checkbox','debounced','cancel-main'].includes(mode)) {
   assert.ok(results.length>0,`${mode} must complete execution`);
   assert.ok(results.every(result=>result.filledCount===0 && result.verifiedCount===0),`${mode} must not claim a verified fill: ${JSON.stringify(results)}`);
  }
  console.log(`control passed: ${mode}`);
  await page.close();
 }
 console.log('control behavior passed: real Vue model, text, radio, checkbox, native date, cancellation, rerender and validation');
};
