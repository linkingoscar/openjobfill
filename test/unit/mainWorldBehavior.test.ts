import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runMainWorldControlAction } from '@/core/adapters/mainWorldDriver';
describe('actual self-contained MAIN-world driver', () => {
 beforeEach(()=>{document.body.innerHTML='';vi.restoreAllMocks();vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue({width:100,height:30,x:0,y:0,top:0,left:0,bottom:30,right:100,toJSON:()=>({})});});
 it('honors cancellation before a MAIN-world text write',async()=>{
  document.body.innerHTML='<input id="name" value="original">';const input=document.querySelector('input')!;input.addEventListener('beforeinput',e=>e.preventDefault());
  expect((await runMainWorldControlAction({action:'TYPE',selectors:['#name'],value:'replacement'})).success).toBe(false);expect(input.value).toBe('original');
 });
 it('never substitutes a university college through substring matching',async()=>{
  document.body.innerHTML='<input id="school" aria-controls="menu"><div id="menu"><div role="option">测试大学独立学院</div></div>';let clicked=false;document.querySelector('[role="option"]')!.addEventListener('click',()=>clicked=true);
  expect((await runMainWorldControlAction({action:'SELECT_TEXT',selectors:['#school'],value:'测试大学'})).success).toBe(false);expect(clicked).toBe(false);
 });
 it('does not click a disabled exact match',async()=>{
  document.body.innerHTML='<input id="school" aria-controls="menu"><div id="menu"><div role="option" aria-disabled="true">测试大学</div></div>';let clicked=false;document.querySelector('[role="option"]')!.addEventListener('click',()=>clicked=true);
  expect((await runMainWorldControlAction({action:'SELECT_TEXT',selectors:['#school'],value:'测试大学'})).success).toBe(false);expect(clicked).toBe(false);
 });
});
