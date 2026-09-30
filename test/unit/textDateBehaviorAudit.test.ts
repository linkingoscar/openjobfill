import { fillDatePicker } from '@/core/engine/datepicker';
import { beforeEach, describe, expect, it } from 'vitest';
import { setNativeValue, setRadioGroupValue, setNativeCheckboxChecked } from '@/core/engine/dispatcher';
import { verifier } from '@/core/pipeline/verifier';
import { dateEngine } from '@/core/resolvers/dateEngine';
import { pageAnalyzer } from '@/core/pipeline/pageAnalyzer';
import { planGenerator } from '@/core/pipeline/planGenerator';
import { pipelineExecutor } from '@/core/pipeline/executor';
import { parseResumeFromText } from '@/core/parser/resumeParser';

describe('control behavior against committed page state', () => {
 beforeEach(() => { document.body.innerHTML = ''; });
 it('honors beforeinput cancellation before changing a text control', () => {
  document.body.innerHTML = '<input value="original">';
  const input = document.querySelector('input')!;
  let observed = '';
  input.addEventListener('beforeinput', e => { observed = input.value; e.preventDefault(); });
  expect(setNativeValue(input, 'replacement')).toBe(false);
  expect(observed).toBe('original');
  expect(input.value).toBe('original');
 });
 it('selects an exact radio option rather than its opposite containing the same word', () => {
  document.body.innerHTML = '<fieldset><label><input type="radio" name="choice" value="不同意">不同意</label><label><input type="radio" name="choice" value="同意">同意</label></fieldset>';
  expect(setRadioGroupValue(document.querySelector('input')!, '同意')).toBe(true);
  expect(document.querySelector<HTMLInputElement>('input:checked')?.value).toBe('同意');
 });
 it('scopes same-name radio options to their owning form', () => {
  document.body.innerHTML = '<form id="other"><label><input type="radio" name="gender" value="男">男</label></form><form id="target"><label><input type="radio" name="gender" value="男">男</label></form>';
  setRadioGroupValue(document.querySelector('#target input')!, '男');
  expect(document.querySelector<HTMLInputElement>('#other input')!.checked).toBe(false);
  expect(document.querySelector<HTMLInputElement>('#target input')!.checked).toBe(true);
 });
 it('does not force a checkbox on after its click was prevented', () => {
  document.body.innerHTML = '<input type="checkbox">';
  const input = document.querySelector('input')!;
  input.addEventListener('click', e => e.preventDefault());
  expect(setNativeCheckboxChecked(input, true)).toBe(false);
  expect(input.checked).toBe(false);
 });
 it('does not report success from a detached input after a controlled rerender', async () => {
  document.body.innerHTML = '<form><div class="form-item"><label>姓名</label><input name="candidateName"></div></form>';
  const input = document.querySelector('input')!;
  input.addEventListener('input', () => { const replacement = input.cloneNode() as HTMLInputElement; replacement.value = ''; input.replaceWith(replacement); }, { once: true });
  const resume = parseResumeFromText(''); resume.basics.name = 'Synthetic Candidate';
  const result = await pipelineExecutor.executePlan(planGenerator.generatePlan(pageAnalyzer.analyzePage(document), resume));
  expect(document.querySelector<HTMLInputElement>('input')!.value).toBe('');
  expect(result.verifiedCount).toBe(0);
  expect(result.filledCount).toBe(0);
 });
 it('reports a page validation error even when displayed text matches', async () => {
  document.body.innerHTML = '<form><div class="form-item"><label>姓名</label><input name="candidateName"></div></form>';
  const input = document.querySelector('input')!;
  input.addEventListener('blur', () => input.setAttribute('aria-invalid', 'true'));
  const resume = parseResumeFromText(''); resume.basics.name = 'Synthetic Candidate';
  const result = await pipelineExecutor.executePlan(planGenerator.generatePlan(pageAnalyzer.analyzePage(document), resume));
  expect(result.verifiedCount).toBe(0);
  expect(result.filledCount).toBe(0);
 });
 it('does not toggle an already-selected current-employment checkbox off', async () => {
  document.body.innerHTML='<div class="form-item"><input placeholder="结束日期"><label>至今<input type="checkbox" checked></label></div>';
  expect(await dateEngine.injectSemanticDate(document.querySelector('input')!, '至今')).toBe(true);
  expect(document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(true);
 });
 it('rejects dates containing trailing junk rather than partially parsing them', () => {
  expect(dateEngine.parseSemanticDate('2024-06junk-18').valid).toBe(false);
  expect(dateEngine.parseSemanticDate('2024-06-18-extra').valid).toBe(false);
 });
 it.each(['manual', 'pipeline'])('%s date entry commits the readonly calendar value', async (entry) => {
  document.body.innerHTML='<form><div class="form-item"><label>出生日期</label><div class="ant-picker"><input readonly placeholder="出生日期"></div></div></form><div class="ant-picker-dropdown" hidden><button type="button" data-date="2001-05-18">18</button></div>';
  const input=document.querySelector('input')!; const popup=document.querySelector<HTMLElement>('.ant-picker-dropdown')!;
  let committed=''; input.addEventListener('click',()=>popup.hidden=false);
  document.querySelector('button')!.addEventListener('click',()=>{committed='2001-05-18';input.value=committed;popup.hidden=true;});
  if (entry === 'manual') expect(await fillDatePicker(input,'2001-05-18')).toBe(true);
  else { const resume=parseResumeFromText(''); resume.basics.birthDate='2001-05-18'; await pipelineExecutor.executePlan(planGenerator.generatePlan(pageAnalyzer.analyzePage(document),resume)); }
  expect(committed).toBe('2001-05-18');
 });

 it('does not count a value rejected by debounced blur validation as successful', async () => {
  document.body.innerHTML='<form><div class="form-item"><label>姓名</label><input name="candidateName"></div></form>';
  const input=document.querySelector('input')!;
  input.addEventListener('blur',()=>setTimeout(()=>{input.value='';input.setAttribute('aria-invalid','true');},120));
  const resume=parseResumeFromText('');resume.basics.name='Synthetic Candidate';
  const result=await pipelineExecutor.executePlan(planGenerator.generatePlan(pageAnalyzer.analyzePage(document),resume));
  expect(result.verifiedCount).toBe(0);
 });

 it('reads the selected current-date checkbox as the end of a date range', async () => {
  document.body.innerHTML='<div class="date-range"><input value="2024-09"><input><label>至今<input type="checkbox" checked></label></div>';
  const value=await verifier.readBack({element:document.querySelector<HTMLElement>('.date-range')!} as any,'date-range');
  expect(value).toEqual({startDate:'2024-09',endDate:'至今'});
 });

 it('compares month-first date displays without accepting malformed identical dates', () => {
  expect(verifier.isSemanticEquivalent('07/2024','2024-07','date')).toBe(true);
  expect(verifier.isSemanticEquivalent('2024-99','2024-99','date')).toBe(false);
 });

 it('does not bypass cancelled input through a later fallback strategy', async () => {
  document.body.innerHTML='<form><div class="form-item"><label>姓名</label><input name="candidateName"></div></form>';
  const input=document.querySelector('input')!;input.addEventListener('beforeinput',e=>e.preventDefault());
  const resume=parseResumeFromText('');resume.basics.name='Synthetic Candidate';
  const result=await pipelineExecutor.executePlan(planGenerator.generatePlan(pageAnalyzer.analyzePage(document),resume));
  expect(input.value).toBe('');expect(result.filledCount).toBe(0);
 });

});
