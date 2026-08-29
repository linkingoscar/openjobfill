import type { SiteAdapter, FillResult } from '../../types/adapter';
import type { StandardResume } from '../../types/resume';
import { sleep } from '../../utils/dom';
import { createFillSession } from './adapterKit';

export const greenhouseAdapter: SiteAdapter = {
  id: 'greenhouse-adapter',
  name: 'Greenhouse & Lever 外企招聘系统',
  description: '适配欧美外企及出海独角兽常用的 Greenhouse 与 Lever 招聘网申系统',
  priority: 100,
  matches: (url: string) => {
    return (
      url.includes('greenhouse.io') ||
      url.includes('lever.co') ||
      !!document.querySelector('#application_form, .application-form, #lever-form')
    );
  },

  async customFill(resume: StandardResume): Promise<FillResult> {
    const s = createFillSession('Greenhouse & Lever 适配器');

    // First Name 字段不能灌全名，必须拆分后回填
    await s.text(
      document,
      [
        'input#first_name',
        'input[name*="first_name"]',
        'input[aria-label*="First name"]',
        'input[name="name"]',
        'input[aria-label*="Full name"]',
      ],
      'First Name',
      'basics.firstName',
      resume.basics.firstName || resume.basics.name
    );

    await s.text(
      document,
      ['input#last_name', 'input[name*="last_name"]', 'input[aria-label*="Last name"]'],
      'Last Name',
      'basics.lastName',
      resume.basics.lastName
    );

    await s.text(
      document,
      ['input#email', 'input[name="email"]', 'input[type="email"]'],
      '电子邮箱',
      'basics.email',
      resume.basics.email
    );

    await s.text(
      document,
      ['input#phone', 'input[name="phone"]', 'input[type="tel"]'],
      '手机号',
      'basics.phone',
      resume.basics.phone
    );

    await s.text(
      document,
      ['input[placeholder*="LinkedIn"]', 'input[name*="linkedin"]'],
      'LinkedIn',
      'basics.linkedinUrl',
      resume.basics.linkedinUrl
    );

    await s.text(
      document,
      ['input[placeholder*="GitHub"]', 'input[name*="github"]'],
      'GitHub',
      'basics.githubUrl',
      resume.basics.githubUrl
    );

    await sleep(200);

    return s.finish();
  },
};
