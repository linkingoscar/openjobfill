import {beforeEach,describe,it,expect} from 'vitest';
import {pageAnalyzer} from '@/core/pipeline/pageAnalyzer';
import {planGenerator} from '@/core/pipeline/planGenerator';
import {pipelineExecutor} from '@/core/pipeline/executor';
import {parseResumeFromText} from '@/core/parser/resumeParser';
import {mokaEnhancer} from '@/core/adapters/enhancers';
const resume=()=>{const r=parseResumeFromText('教育经历\n硕士-测试大学-2024.09-2027.06-软件工程-统招全日制\n本科-示例大学-2020.09-2024.06-计算机科学-统招全日制');r.basics.name='虚构测试候选人';r.basics.phone='13900000001';r.basics.email='fictional@example.com';return r;};
const input=(p:string)=>`<input class="sd-Input-input-10L0t sd-Input-has-addon-3djHe" placeholder="${p}">`;
const row=(l:string,c:string)=>`<div><div class="field-title">${l}</div><div><div>${c}</div></div></div>`;
describe('Independent practical audit',()=>{
beforeEach(()=>{document.body.innerHTML='';});
it('split education year/month surfaces required manual work',()=>{
 document.body.innerHTML=`<form><div class="education-card">${row('就读时间 *',input('年')+input('月')+'至'+input('年')+input('月'))}${row('学校名称 *',input('请输入就读学校'))}</div></form>`;
 const plan=planGenerator.generatePlan(pageAnalyzer.analyzePage(document),resume(),mokaEnhancer);
 expect(plan.items.filter(i=>i.field.placeholder==='年'||i.field.placeholder==='月').filter(i=>i.action==='NEEDS_USER'&&i.field.required)).toHaveLength(4);
});
it('truncating controlled input must be failure not verified success',async()=>{
 document.body.innerHTML='<form><div class="form-item"><label>姓名</label><input name="candidateName"></div></form>';
 const el=document.querySelector('input')!; el.addEventListener('input',()=>{el.value=el.value.slice(0,4)});
 const result=await pipelineExecutor.executePlan(planGenerator.generatePlan(pageAnalyzer.analyzePage(document),resume(),mokaEnhancer));
 expect(result.filledCount).toBe(0);
});
});
