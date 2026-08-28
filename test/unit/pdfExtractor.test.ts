import { describe, it, expect } from 'vitest';
import { clusterLinesToString, reconstructPdfLayout, type PdfLayoutItem } from '@/core/parser/textExtractor';

describe('PDF Layout & Spatial Reconstruction Suite (PDF空间坐标与两栏重排恢复测试)', () => {
  describe('1. 单行与多行 Y 轴聚类与 X 轴水平排序', () => {
    it('同一水平线上的散落文本块，应按 X 坐标从左到右排序拼接', () => {
      const items: PdfLayoutItem[] = [
        { str: '前端开发工程师', x: 200, y: 700, width: 80, height: 12 },
        { str: '求职意向：', x: 100, y: 700, width: 60, height: 12 },
        { str: '期望薪资：25k', x: 320, y: 700, width: 70, height: 12 },
      ];

      const result = clusterLinesToString(items);
      expect(result).toBe('求职意向： 前端开发工程师 期望薪资：25k');
    });

    it('不同 Y 轴高度的文本，应按从上到下 (Y 降序) 正确聚类成多行', () => {
      const items: PdfLayoutItem[] = [
        { str: '13800000000', x: 200, y: 750, width: 80, height: 12 },
        { str: '张小明', x: 100, y: 780, width: 50, height: 16 },
        { str: 'zhang@example.com', x: 300, y: 750, width: 100, height: 12 },
        { str: '求职意向：Java研发', x: 100, y: 720, width: 100, height: 12 },
      ];

      const result = clusterLinesToString(items);
      const lines = result.split('\n');

      expect(lines.length).toBe(3);
      expect(lines[0]).toBe('张小明');
      expect(lines[1]).toContain('13800000000');
      expect(lines[1]).toContain('zhang@example.com');
      expect(lines[2]).toBe('求职意向：Java研发');
    });
  });

  describe('2. 双栏简历排版解构与重组 (Two-Column Layout Recovery)', () => {
    it('对于左右双栏简历，必须先完整输出左栏内容，再输出右栏内容，绝不能左右穿插交叉', () => {
      // 模拟双栏简历：左侧栏 (X: 50~200)，右侧栏 (X: 300~550)
      const twoColumnItems: PdfLayoutItem[] = [
        // 左栏：个人基本信息
        { str: '【基本信息】', x: 60, y: 750, width: 80, height: 12 },
        { str: '姓名：李华', x: 60, y: 720, width: 60, height: 12 },
        { str: '电话：13900000000', x: 60, y: 690, width: 100, height: 12 },
        { str: '邮箱：lihua@test.com', x: 60, y: 660, width: 110, height: 12 },
        { str: '现居：北京市海淀区', x: 60, y: 630, width: 110, height: 12 },
        { str: '政治面貌：共青团员', x: 60, y: 600, width: 110, height: 12 },
        { str: 'CET-6: 590分', x: 60, y: 570, width: 80, height: 12 },
        { str: '求职状态：应届生', x: 60, y: 540, width: 90, height: 12 },

        // 右栏：教育与工作经历
        { str: '【教育背景】', x: 350, y: 750, width: 80, height: 12 },
        { str: '北京航空航天大学 · 软件工程 · 硕士', x: 350, y: 720, width: 200, height: 12 },
        { str: '2023.09 - 2026.06', x: 350, y: 690, width: 120, height: 12 },
        { str: '【工作实习】', x: 350, y: 650, width: 80, height: 12 },
        { str: '某科技巨头公司 · 前端架构实习生', x: 350, y: 620, width: 180, height: 12 },
        { str: '负责核心性能优化，FCP 降低 45%', x: 350, y: 590, width: 190, height: 12 },
        { str: '【项目经历】', x: 350, y: 550, width: 80, height: 12 },
        { str: '开源自动化填表助手 OpenJobFill', x: 350, y: 520, width: 180, height: 12 },
      ];

      // 转换为 PDF.js raw items
      const rawItems = twoColumnItems.map(it => ({
        str: it.str,
        transform: [12, 0, 0, 12, it.x, it.y],
        width: it.width,
        height: it.height,
      }));

      const output = reconstructPdfLayout(rawItems, 600);

      // 验证左栏的信息必须在右栏前面，绝不交叉
      const phoneIndex = output.indexOf('电话：13900000000');
      const eduTitleIndex = output.indexOf('【教育背景】');
      const statusIndex = output.indexOf('求职状态：应届生');
      const workTitleIndex = output.indexOf('【工作实习】');

      expect(phoneIndex).toBeGreaterThan(-1);
      expect(eduTitleIndex).toBeGreaterThan(-1);
      expect(statusIndex).toBeGreaterThan(-1);

      // 左栏全部内容输出完毕后，才输出右栏内容
      expect(statusIndex).toBeLessThan(workTitleIndex);
    });
  });
});
