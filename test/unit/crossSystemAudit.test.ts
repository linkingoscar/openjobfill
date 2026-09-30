import {beforeEach,describe,it,expect} from 'vitest';
import {pageAnalyzer} from '@/core/pipeline/pageAnalyzer';
import {planGenerator} from '@/core/pipeline/planGenerator';
import {pipelineExecutor} from '@/core/pipeline/executor';
import {parseResumeFromText} from '@/core/parser/resumeParser';
import {mokaEnhancer,beisenEnhancer,dayeeEnhancer,feishuEnhancer} from '@/core/adapters/enhancers';
const r=parseResumeFromText('教育经历\n硕士-测试大学-2024.09-2027.06-软件工程-统招全日制');r.basics.name='虚构测试候选人';r.basics.phone='13900000001';r.basics.email='fictional@example.com';
const cases=[
['moka',mokaEnhancer,'紧急联系人电话','<input type="tel" name="emergencyMobile">','basics.phone'],
['beisen',beisenEnhancer,'紧急联系人电话','<input id="emergencyMobile">','basics.phone'],
['dayee',dayeeEnhancer,'紧急联系人电话','<input name="emergencyMobile">','basics.phone'],
['feishu',feishuEnhancer,'紧急联系人电话','<input placeholder="请输入紧急联系人手机号">','basics.phone'],
['beisen-school',beisenEnhancer,'毕业院校','<input id="schoolName">','basics.name'],
['beisen-company',beisenEnhancer,'公司名称','<input id="companyName">','basics.name'],
] as const;
describe('Cross-system practical audit',()=>{
beforeEach(()=>document.body.innerHTML='');
for(const [name,enhancer,label,markup,wrongKey] of cases)it(name,async()=>{
 document.body.innerHTML=`<form><div class="form-item"><label>${label}</label>${markup}</div></form>`;
 const fields=pageAnalyzer.analyzePage(document);const plan=planGenerator.generatePlan(fields,r,enhancer);const result=await pipelineExecutor.executePlan(plan);
 console.log(name,JSON.stringify({items:plan.items.map(i=>({key:i.semanticKey,action:i.action})),actual:(document.querySelector('input') as HTMLInputElement).value,filled:result.filledCount,verified:result.verifiedCount}));
 expect(plan.items.some(i=>i.action==='FILL'&&i.semanticKey===wrongKey)).toBe(false);
});
it('generic no-enhancer should not misfill emergency contact',()=>{
 document.body.innerHTML='<form><div class="form-item"><label>紧急联系人电话</label><input type="tel" name="emergencyMobile"></div></form>';
 expect(planGenerator.generatePlan(pageAnalyzer.analyzePage(document),r).items.some(i=>i.action==='FILL'&&i.semanticKey==='basics.phone')).toBe(false);
});
it('native school select must not accept a different institution sharing its prefix',async()=>{
 document.body.innerHTML='<form><label>学校名称</label><select name="school"><option value="">请选择</option><option value="independent">测试大学独立学院</option></select></form>';
 const plan=planGenerator.generatePlan(pageAnalyzer.analyzePage(document),r);const result=await pipelineExecutor.executePlan(plan);
 console.log('school-prefix',JSON.stringify({actual:(document.querySelector('select') as HTMLSelectElement).selectedOptions[0].text,filled:result.filledCount,verified:result.verifiedCount}));expect(result.verifiedCount).toBe(0);expect((document.querySelector('select') as HTMLSelectElement).value).toBe('');
});
});
