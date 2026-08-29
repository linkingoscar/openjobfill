/**
 * 通过点路径读取对象内部值
 * 如 'basics.name'、'educations.0.schoolName'、'familyMembers.1.phone'
 */
export function getValueByPath(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}
