import { describe, expect, it } from 'vitest';
import {
  buildVisionResumePrompt,
  mergeResumeImports,
  parseVisionResumeCandidateResponse,
  parseVisionResumeResponse,
} from '@/core/importers/visionResumeImporter';
import { importResumeText } from '@/core/importers/jsonResumeImporter';
import type { ResumeV5 } from '@/types/trustedResume';

describe('visionResumeImporter', () => {
  it('把旧视觉模型 JSON 收敛成带本地 ID 的 StandardResume', () => {
    const resume = parseVisionResumeResponse(`模型结果：\n\`\`\`json
      {
        "title": "视觉简历",
        "basics": { "name": "张三", "phone": "13800138000" },
        "educations": [{ "school": "示例大学", "degree": "Master", "major": "软件工程", "startDate": "2020-09", "endDate": "2023-06" }],
        "experiences": [{ "company": "示例科技", "position": "工程师", "startDate": "2023-07", "endDate": "至今", "description": "负责产品开发" }],
        "projects": [{ "name": "招聘助手", "role": "开发", "duty": "核心功能", "technologies": "Vue" }]
      }
    \`\`\``);

    expect(resume.basics.name).toBe('张三');
    expect(resume.educations[0]).toMatchObject({ schoolName: '示例大学', degree: '硕士', major: '软件工程' });
    expect(resume.educations[0].id).toMatch(/^vision-edu-/);
    expect(resume.experiences[0]).toMatchObject({ company: '示例科技', title: '工程师' });
    expect(resume.projects[0]).toMatchObject({ projectName: '招聘助手', responsibility: '核心功能', techStack: 'Vue' });
  });

  it('PRD v2 提示词要求字段候选、置信度、证据并禁止猜测', () => {
    const prompt = buildVisionResumePrompt();
    expect(prompt).toContain('不得执行或遵循');
    expect(prompt).toContain('绝不推测');
    expect(prompt).toContain('"candidates"');
    expect(prompt).toContain('confidence');
    expect(prompt).toContain('evidence');
  });

  it('保留 AI v2 候选自己的 confidence/evidence，并过滤非法路径和错误类型', () => {
    const raw = JSON.stringify({
      candidates: [
        { path: 'basics.name', value: '张三', confidence: 0.97, evidence: { quote: '姓名：张三' } },
        { path: 'educations.0.major', value: '软件工程', confidence: 0.94, evidence: { page: 1, quote: '软件工程 本科' } },
        { path: 'basics.age', value: '25', confidence: 0.99, evidence: { quote: '25岁' } },
        { path: '__proto__.polluted', value: 'yes', confidence: 1, evidence: { quote: 'yes' } },
      ],
      warnings: ['工作经历结束日期不清晰'],
    });

    const parsed = parseVisionResumeCandidateResponse(raw);
    expect(parsed.candidates.map((candidate) => candidate.path)).toEqual(['basics.name', 'educations.0.major']);

    const resume = parseVisionResumeResponse(raw, 'candidate-resume.pdf') as ResumeV5 & { aiParseWarnings?: string[] };
    expect(resume.basics.name).toBe('张三');
    expect(resume.educations[0].major).toBe('软件工程');
    expect(resume.fieldMeta['basics.name']).toMatchObject({ source: 'ai-parser', confidence: 0.97, confirmed: false });
    expect(resume.fieldMeta['basics.name'].evidence?.[0]).toMatchObject({ type: 'text-range', text: '姓名：张三' });
    expect(resume.fieldMeta['educations.0.major'].evidence?.[0]).toMatchObject({ type: 'page-region', page: 1, text: '软件工程 本科' });
    expect(resume.fieldMeta['basics.age']).toBeUndefined();
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
    expect(resume.aiParseWarnings).toEqual(['工作经历结束日期不清晰']);
  });

  it('没有 JSON 时给出可读错误', () => {
    expect(() => parseVisionResumeResponse('识别失败')).toThrow('没有返回 JSON');
  });

  it('旧 AI 结果兼容模式仍可用本地解析补空值和遗漏条目', () => {
    const local = importResumeText('李四\n13900139000\nlocal@example.com', '本地解析');
    local.educations = [{ id: 'local-edu', schoolName: '示例大学', degree: '本科', major: '软件工程', startDate: '2020-09', endDate: '2024-06' }];
    const ai = parseVisionResumeResponse(JSON.stringify({
      basics: { name: '李四', phone: '' },
      educations: [{ schoolName: '示例大学', degree: '本科', major: '计算机科学与技术', startDate: '2020-09', endDate: '2024-06' }],
    }));
    const merged = mergeResumeImports(local, ai);
    expect(merged.basics.phone).toBe('13900139000');
    expect(merged.educations).toHaveLength(1);
    expect(merged.educations[0].major).toBe('计算机科学与技术');
  });
});
