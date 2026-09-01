import type { StandardResume, WorkExperience } from '../../types/resume';

export function deriveCombinedExperience(resume: StandardResume): WorkExperience[] {
  const experiences = resume.experiences.map((experience) => ({ ...experience }));
  const projects: WorkExperience[] = resume.projects.map((project) => ({
    id: project.id,
    company: project.projectName,
    title: project.role,
    jobType: '实习',
    startDate: project.startDate,
    endDate: project.endDate,
    description: [project.description, project.techStack ? `技术栈：${project.techStack}` : ''].filter(Boolean).join('\n'),
    achievements: [project.responsibility, project.achievements].filter(Boolean).join('\n'),
    techStack: project.techStack,
  }));
  return [...experiences, ...projects].sort((left, right) => right.startDate.localeCompare(left.startDate));
}

export function deriveEducationHonors(resume: StandardResume): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const education of resume.educations) {
    const honors = (resume.awards || [])
      .filter((award) => !!award.issueDate && award.issueDate >= education.startDate && award.issueDate <= (education.endDate || '9999-99'))
      .map((award) => [award.issueDate, award.name, award.level ? `(${award.level})` : ''].filter(Boolean).join(' '));
    result[education.id] = honors;
    result[`${education.schoolName}${education.degree}`] = honors;
  }
  return result;
}

export function deriveLanguageSummary(resume: StandardResume): string {
  if (!resume.languages.length) return '';
  return resume.languages.map((language) => {
    const certificate = [language.certificateName, language.score ? `${language.score}分` : ''].filter(Boolean).join(' ');
    return [language.language, certificate && `(${certificate})`, language.proficiency].filter(Boolean).join(' ');
  }).join('；');
}

/** undefined 表示用户没有回答，调用方必须转为待办，不能沿用旧版默认“是”的行为。 */
export function deriveWillingnessDecision(
  fieldText: string,
  resume: StandardResume
): { targetText: string; isAffirmative: boolean } | null {
  const candidates: Array<[RegExp, boolean | undefined, [string, string]]> = [
    [/加班|overtime/i, resume.basics.acceptOvertime, ['是', '否']],
    [/出差|外派|business\s*trip/i, resume.basics.acceptBusinessTrip, ['是', '否']],
    [/调剂|服从分配|adjustable/i, resume.basics.adjustable, ['是', '否']],
    [/城市|地点|flexible/i, resume.basics.cityFlexible, ['是', '否']],
    [/亲属|亲友|relative/i, resume.basics.hasRelatives, ['有', '无']],
    [/处分|违纪|违法|punishment/i, resume.basics.hasPunishment, ['是', '无']],
  ];
  const matched = candidates.find(([pattern]) => pattern.test(fieldText));
  if (!matched || matched[1] === undefined) return null;
  return { targetText: matched[1] ? matched[2][0] : matched[2][1], isAffirmative: matched[1] };
}
