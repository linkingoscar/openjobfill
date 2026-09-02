import type { StandardResume } from '../../types/resume';

/** Import completeness hints, independent of the import source and preview UI. */
export function assessResumeImport(r: StandardResume) {
  let identifiedCount = 0;
  if (r.basics.name) identifiedCount++;
  if (r.basics.phone) identifiedCount++;
  if (r.basics.email) identifiedCount++;
  if (r.basics.gender) identifiedCount++;
  if (r.basics.birthDate) identifiedCount++;
  if (r.basics.politicalStatus) identifiedCount++;
  if (r.basics.expectedRole) identifiedCount++;
  if (r.basics.currentLocation?.city) identifiedCount++;
  if (r.basics.nativePlace?.city) identifiedCount++;
  if (r.basics.birthPlace?.city) identifiedCount++;
  if (r.basics.hobbies) identifiedCount++;
  if (r.basics.selfEvaluation) identifiedCount++;
  identifiedCount += (r.educations?.length || 0) * 3;
  identifiedCount += (r.experiences?.length || 0) * 3;
  identifiedCount += (r.projects?.length || 0) * 2;
  identifiedCount += (r.skills?.length || 0);
  identifiedCount += (r.languages?.length || 0) * 2;
  identifiedCount += (r.certificates?.length || 0);
  identifiedCount += (r.familyMembers?.length || 0) * 3;
  identifiedCount += (r.awards?.length || 0) * 2;
  identifiedCount += (r.academicAchievements?.length || 0) * 2;
  identifiedCount += (r.campusExperiences?.length || 0) * 2;

  const missingItems: string[] = [];
  if (!r.basics.gender) missingItems.push('性别');
  if (!r.basics.nativePlace?.city && !r.basics.nativePlace?.province) missingItems.push('籍贯 / 生源地');
  if (!r.basics.hukouLocation?.city && !r.basics.hukouLocation?.province) missingItems.push('户口所在地');
  if (!r.basics.availableTime) missingItems.push('到岗时间');
  if (!r.basics.maritalStatus) missingItems.push('婚姻状况');
  if (!r.basics.height) missingItems.push('身高');
  if (!r.basics.expectedSalaryMin) missingItems.push('期望薪资');
  if ((!r.certificates || r.certificates.length === 0) && (!r.languages || r.languages.length === 0)) missingItems.push('CET-4/6 英语成绩或证书');
  if (!r.basics.idCardNumber) missingItems.push('身份证号');

  const warnings: string[] = [];
  r.educations?.forEach((edu, i) => {
    if (!edu.endDate) warnings.push(`第 ${i + 1} 段教育缺少毕业年月`);
    if (!edu.major) warnings.push(`第 ${i + 1} 段教育缺少专业`);
  });
  r.experiences?.forEach((exp, i) => {
    if (!exp.startDate || !exp.endDate) warnings.push(`第 ${i + 1} 段经历起止时间不完整`);
  });

  return {
    identifiedCount,
    missingItems,
    warnings,
  };
}
