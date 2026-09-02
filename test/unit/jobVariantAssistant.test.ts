import { describe, expect, it } from 'vitest';
import { EMPTY_RESUME } from '../../src/core/storage/defaultData';
import { validateJobVariantSuggestions } from '../../src/core/ai/contentAssistant';
import { buildJobVariantPrompt, parseJobVariantSuggestions } from '../../src/core/ai/jobVariantAssistant';

function resumeFixture() {
  const resume = structuredClone(EMPTY_RESUME);
  resume.skills = [{ id: 's1', name: 'TypeScript', level: '熟练' }];
  resume.projects = [
    { id: 'p1', projectName: '项目一', role: '开发', startDate: '2025-01', endDate: '2025-02', description: 'TypeScript 项目', responsibility: '负责前端' },
    { id: 'p2', projectName: '项目二', role: '开发', startDate: '2025-03', endDate: '2025-04', description: '性能优化项目', responsibility: '负责性能' },
  ];
  resume.experiences = [
    { id: 'e1', company: '示例公司', title: '实习生', startDate: '2025-05', endDate: '2025-08', description: '前端开发' },
  ];
  resume.basics.githubUrl = 'https://github.com/example';
  resume.basics.selfEvaluation = '熟悉 TypeScript，有前端项目经验。';
  return resume;
}

describe('AI job variant suggestions', () => {
  it('parses strict structured suggestions and rejects malformed JSON', () => {
    expect(parseJobVariantSuggestions('not json')).toEqual([]);
    const parsed = parseJobVariantSuggestions(JSON.stringify({ suggestions: [{
      id: 'order', type: 'project-order', suggestion: '调整项目顺序',
      evidenceResumeKeys: ['projects.0.projectName'], orderedIds: ['p2', 'p1'],
    }] }));
    expect(parsed).toHaveLength(1);
    expect(parsed[0].orderedIds).toEqual(['p2', 'p1']);
  });

  it('only accepts complete existing record order and existing skills/links', () => {
    const resume = resumeFixture();
    const validated = validateJobVariantSuggestions([
      { id: 'valid-order', type: 'project-order', suggestion: '项目二优先', evidenceResumeKeys: ['projects.1.projectName'], orderedIds: ['p2', 'p1'] },
      { id: 'bad-order', type: 'project-order', suggestion: '新增项目', evidenceResumeKeys: ['projects.0.projectName'], orderedIds: ['invented', 'p1'] },
      { id: 'valid-skill', type: 'skill-highlight', suggestion: '突出 TypeScript', evidenceResumeKeys: ['skills.0.name'], highlightSkills: ['TypeScript'] },
      { id: 'bad-skill', type: 'skill-highlight', suggestion: '补充 Rust', evidenceResumeKeys: ['skills.0.name'], highlightSkills: ['Rust'] },
      { id: 'valid-link', type: 'link-selection', suggestion: '只展示 GitHub', evidenceResumeKeys: ['basics.githubUrl'], selectedLinks: ['basics.githubUrl'] },
    ], resume);
    expect(validated.map((item) => item.id)).toEqual(['valid-order', 'valid-skill', 'valid-link']);
  });

  it('allows only presentation text paths and requires resume evidence', () => {
    const resume = resumeFixture();
    const validated = validateJobVariantSuggestions([
      { id: 'self', type: 'self-evaluation', resumeKey: 'basics.selfEvaluation', proposedValue: 'TypeScript 与前端项目经验匹配岗位要求。', suggestion: '裁剪自评', evidenceResumeKeys: ['basics.selfEvaluation', 'skills.0.name'] },
      { id: 'fact', type: 'short-description', resumeKey: 'experiences.0.company', proposedValue: '伪造公司', suggestion: '修改公司', evidenceResumeKeys: ['experiences.0.company'] },
      { id: 'missing-evidence', type: 'self-evaluation', resumeKey: 'basics.selfEvaluation', proposedValue: '无依据', suggestion: '无依据', evidenceResumeKeys: ['skills.9.name'] },
    ], resume);
    expect(validated).toHaveLength(1);
    expect(validated[0].id).toBe('self');
  });

  it('prompt explicitly forbids new facts and constrains actionable output', () => {
    const prompt = buildJobVariantPrompt({ facts: { 'skills.0.name': 'TypeScript' }, jdText: '需要 TypeScript' });
    expect(prompt).toContain('绝不能新增技能');
    expect(prompt).toContain('orderedIds');
    expect(prompt).toContain('basics.selfEvaluation');
  });
});
