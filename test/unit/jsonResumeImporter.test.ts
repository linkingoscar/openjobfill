import { describe, expect, it } from 'vitest';
import { importJsonResume, importResumeText } from '../../src/core/importers/jsonResumeImporter';

describe('JSON Resume importer', () => {
  it('映射标准 JSON Resume 的核心字段和多段经历', () => {
    const resume = importJsonResume({
      basics: {
        name: 'Alex Chen',
        label: 'Frontend Engineer',
        email: 'alex@example.com',
        location: { city: 'Shanghai', region: 'Shanghai', countryCode: 'CN' },
        profiles: [{ network: 'GitHub', url: 'https://github.com/alex' }],
      },
      education: [{ institution: 'Example University', studyType: 'Master', area: 'Computer Science', startDate: '2021-09-01', endDate: '2024-06-30' }],
      work: [{ name: 'Example Inc.', position: 'Developer', startDate: '2024-07', highlights: ['Built a platform'] }],
      projects: [{ name: 'Open Project', roles: ['Maintainer'], keywords: ['Vue', 'TypeScript'] }],
      skills: [{ name: 'Frontend', level: 'Advanced', keywords: ['Vue', 'TypeScript'] }],
    }, 'fallback');

    expect(resume.basics.name).toBe('Alex Chen');
    expect(resume.basics.expectedRole).toBe('Frontend Engineer');
    expect(resume.basics.githubUrl).toBe('https://github.com/alex');
    expect(resume.educations[0]).toMatchObject({ degree: '硕士', startDate: '2021-09', endDate: '2024-06' });
    expect(resume.experiences[0]).toMatchObject({ company: 'Example Inc.', title: 'Developer', endDate: '至今' });
    expect(resume.projects[0].techStack).toBe('Vue、TypeScript');
    expect(resume.skills.map((item) => item.name)).toEqual(['Vue', 'TypeScript']);
  });

  it('对看起来完整但格式不支持的 JSON 给出错误，不静默当纯文本', () => {
    expect(() => importResumeText('{"foo":"bar"}', 'test')).toThrow(/未识别/);
  });
});

