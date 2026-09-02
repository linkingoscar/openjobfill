export type DrawerTab = 'logs' | 'review' | 'clipboard' | 'jdMatch';

export type ClipboardCategory =
  | '基本信息'
  | '教育经历'
  | '工作实习'
  | '项目经历'
  | '技能证书'
  | '家庭成员'
  | '成果荣誉'
  | '校园经历'
  | '问答与评价';

export interface ClipboardItem {
  id: string;
  category: ClipboardCategory;
  label: string;
  value: string;
}
