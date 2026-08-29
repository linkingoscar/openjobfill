import type { SiteAdapter, FillResult } from '../../types/adapter';
import type { StandardResume } from '../../types/resume';
import { sleep } from '../../utils/dom';
import { createFillSession } from './adapterKit';

export const workdayAdapter: SiteAdapter = {
  id: 'workday-adapter',
  name: 'Workday 招聘系统',
  description: '适配外企与跨国企业广泛使用的 Workday 网申系统 (myworkdayjobs)',
  priority: 100,
  matches: (url: string) => {
    return (
      url.includes('myworkdayjobs.com') ||
      url.includes('workday.com') ||
      !!document.querySelector('[data-automation-id]')
    );
  },

  async customFill(resume: StandardResume): Promise<FillResult> {
    const s = createFillSession('Workday 招聘系统适配器');

    // Workday 把姓名拆成 First / Last 两段，不能把全名灌进 First Name
    await s.text(
      document,
      [
        'input[data-automation-id="legalNameSection_firstName"]',
        'input[data-automation-id*="firstName"]',
      ],
      'First Name',
      'basics.firstName',
      resume.basics.firstName || resume.basics.name
    );

    await s.text(
      document,
      [
        'input[data-automation-id="legalNameSection_lastName"]',
        'input[data-automation-id*="lastName"]',
      ],
      'Last Name',
      'basics.lastName',
      resume.basics.lastName
    );

    await s.text(
      document,
      ['input[data-automation-id="phone-number"]', 'input[data-automation-id*="phone"]'],
      '手机号',
      'basics.phone',
      resume.basics.phone
    );

    await s.text(
      document,
      ['input[data-automation-id="email"]', 'input[data-automation-id*="email"]'],
      '电子邮箱',
      'basics.email',
      resume.basics.email
    );

    await s.text(
      document,
      ['input[data-automation-id="addressSection_city"]', 'input[data-automation-id*="city"]'],
      '居住城市',
      'basics.currentLocation.city',
      resume.basics.currentLocation?.city
    );

    await s.text(
      document,
      ['input[data-automation-id="addressSection_postalCode"]', 'input[data-automation-id*="postalCode"]'],
      '邮政编码',
      'basics.postalCode',
      resume.basics.postalCode
    );

    if (resume.educations && resume.educations.length > 0) {
      const edu = resume.educations[0];

      await s.text(
        document,
        ['input[data-automation-id="school"]', 'input[data-automation-id*="school"]'],
        '学校名称',
        'educations.0.schoolName',
        edu.schoolName
      );
    }

    await sleep(200);

    return s.finish();
  },
};
