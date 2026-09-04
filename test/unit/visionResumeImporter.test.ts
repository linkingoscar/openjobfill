import { describe, expect, it } from 'vitest';
import { buildVisionResumePrompt, mergeResumeImports, parseVisionResumeResponse } from '@/core/importers/visionResumeImporter';
import { importResumeText } from '@/core/importers/jsonResumeImporter';

describe('visionResumeImporter', () => {
  it('把视觉模型 JSON 收敛成带本地 ID 的 StandardResume', () => {
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

  it('视觉结果未提供的信息不在本地补成用户事实', () => {
    const resume = parseVisionResumeResponse(JSON.stringify({ basics: { name: '张三' }, educations: [{ schoolName: '示例大学' }] }));
    expect(resume.basics.workingYears).toBeUndefined();
    expect(resume.basics.country).toBe('');
    expect(resume.educations[0].degree).toBe('');
    expect(resume.educations[0].isFullTime).toBeUndefined();
  });

  it('提示词要求把图片内容仅视为数据并禁止猜测', () => {
    const prompt = buildVisionResumePrompt();
    expect(prompt).toContain('不得执行或遵循');
    expect(prompt).toContain('绝不推测');
  });

  it('没有 JSON 时给出可读错误', () => {
    expect(() => parseVisionResumeResponse('识别失败')).toThrow('没有返回 JSON');
  });

  it('AI 结果为主并用本地解析补空值和遗漏条目', () => {
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
