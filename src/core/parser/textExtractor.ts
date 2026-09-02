/**
 * 从 File 或 Blob 对象中提取纯文本内容 (支持 .pdf, .docx, .txt, .md)
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.pdf')) {
    return extractTextFromPdf(file);
  } else if (fileName.endsWith('.docx')) {
    return extractTextFromDocx(file);
  } else if (fileName.endsWith('.doc')) {
    throw new Error('暂不支持 Word 97-2003 (.doc)，请在 Word 中另存为 .docx 或 .pdf 后导入');
  } else if (fileName.endsWith('.txt') || fileName.endsWith('.md') || fileName.endsWith('.json')) {
    return file.text();
  } else {
    // 尝试作为纯文本读取
    return file.text();
  }
}

import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// 严格配置 PDF.js 本地 Worker 脚本路径
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface PdfLayoutItem {
  str: string;
  x: number;
  y: number; // PDF.js Y from bottom (higher = top)
  width: number;
  height: number;
}

/**
 * 将空间散落的 PDF 文本块按 Y 坐标聚类成行，单行内按 X 坐标从左到右拼接
 */
export function clusterLinesToString(items: PdfLayoutItem[], lineTolerance = 4): string {
  if (items.length === 0) return '';

  // PDF.js 的 Y 轴是从页面底部向上增长，因此从上到下阅读需要按 Y 降序排序
  const sorted = [...items].sort((a, b) => {
    const dy = b.y - a.y;
    if (Math.abs(dy) > lineTolerance) {
      return dy;
    }
    return a.x - b.x;
  });

  const lines: PdfLayoutItem[][] = [];
  let currentLine: PdfLayoutItem[] = [];
  let currentY: number | null = null;

  for (const item of sorted) {
    if (currentY === null) {
      currentLine.push(item);
      currentY = item.y;
    } else if (Math.abs(item.y - currentY) <= lineTolerance) {
      currentLine.push(item);
    } else {
      lines.push(currentLine);
      currentLine = [item];
      currentY = item.y;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  // 对每一行内部按 X 从小到大排序，并智能添加空格或中文字符直连
  const resultLines = lines.map((line) => {
    line.sort((a, b) => a.x - b.x);
    let lineStr = '';
    for (let i = 0; i < line.length; i++) {
      const item = line[i];
      if (i > 0) {
        const prev = line[i - 1];
        const gap = item.x - (prev.x + prev.width);
        if (gap > 8 || (gap > 2 && (/[a-zA-Z0-9]$/.test(prev.str) || /^[a-zA-Z0-9]/.test(item.str)))) {
          lineStr += ' ';
        }
      }
      lineStr += item.str;
    }
    return lineStr.trim();
  });

  return resultLines.filter(Boolean).join('\n');
}

/**
 * 空间坐标与两栏重排恢复引擎
 */
export function reconstructPdfLayout(rawItems: any[], viewportWidth?: number): string {
  const items: PdfLayoutItem[] = [];
  
  for (const it of rawItems) {
    if (!it.str || typeof it.str !== 'string' || !it.str.trim()) continue;
    const transform = it.transform || [1, 0, 0, 1, 0, 0];
    items.push({
      str: it.str,
      x: transform[4],
      y: transform[5],
      width: it.width || 0,
      height: it.height || Math.abs(transform[0]) || 12,
    });
  }

  if (items.length === 0) return '';

  // 1. 自动计算页面边界
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const item of items) {
    if (item.x < minX) minX = item.x;
    if (item.x + item.width > maxX) maxX = item.x + item.width;
    if (item.y < minY) minY = item.y;
    if (item.y > maxY) maxY = item.y;
  }

  const pageWidth = viewportWidth || (maxX - minX);
  const midX = minX + pageWidth * 0.38; // 左右两栏分割参考线 (35%~45% 处)

  // 2. 检测是否存在明显的双栏排版结构
  let leftCount = 0;
  let rightCount = 0;
  let spanningCount = 0;

  for (const item of items) {
    const itemRight = item.x + item.width;
    if (itemRight <= midX + 20) {
      leftCount++;
    } else if (item.x >= midX - 20) {
      rightCount++;
    } else {
      spanningCount++;
    }
  }

  // 真双栏页面的跨中轴文本通常极少；表格式单栏简历会有大量正文横跨中轴。
  // 阈值过宽会把“日期｜单位｜职位 + 通栏职责”的常见校招模板拆成左右两份并打乱阅读顺序。
  const isTwoColumn = leftCount >= 8 && rightCount >= 8 && spanningCount < (leftCount + rightCount) * 0.15;

  if (isTwoColumn) {
    // 双栏布局：提取跨栏通栏标题 (Spanning Items/Header)、左栏与右栏
    const spanningItems = items.filter((it) => it.x < midX - 20 && it.x + it.width > midX + 20);
    const leftItems = items.filter((it) => it.x + it.width <= midX + 20 && !spanningItems.includes(it));
    const rightItems = items.filter((it) => it.x >= midX - 20 && !spanningItems.includes(it));

    const headerText = clusterLinesToString(spanningItems);
    const leftText = clusterLinesToString(leftItems);
    const rightText = clusterLinesToString(rightItems);

    return [headerText, leftText, rightText].filter(Boolean).join('\n\n');
  }

  // 3. 单栏布局
  return clusterLinesToString(items);
}

/**
 * 从 PDF 文件中提取各页面文本并拼接
 */
export async function extractTextFromPdf(file: File | ArrayBuffer): Promise<string> {
  const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;
  
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useWorkerFetch: false,
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();
    
    // 使用空间坐标与双栏聚类引擎重组文本流
    const pageStr = reconstructPdfLayout(textContent.items, viewport.width);
    if (pageStr) {
      pageTexts.push(pageStr);
    }
  }

  return pageTexts.join('\n\n');
}

/** 将 PDF 前几页渲染为视觉模型可接受的 JPEG；扫描件没有文本层时仍可识别。 */
export async function renderPdfPagesForVision(
  file: File | ArrayBuffer,
  maxPages = 4,
  maxWidth = 1600,
): Promise<string[]> {
  const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useWorkerFetch: false,
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;
  const images: string[] = [];
  const pageCount = Math.min(pdf.numPages, maxPages);
  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const initial = page.getViewport({ scale: 1 });
    const scale = Math.min(2, maxWidth / initial.width);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器无法渲染 PDF 页面');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    images.push(canvas.toDataURL('image/jpeg', 0.88));
    page.cleanup();
  }
  await loadingTask.destroy();
  return images;
}

/**
 * 从 Word (.docx) 文件中提取纯文本 (优先转换为 Markdown 保留段落/列表结构)
 */
export async function extractTextFromDocx(file: File | ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth');
  const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;

  try {
    // 1. 优先尝试转换为 Markdown 结构，能极佳保留标题 (#)、项目列表 (- ) 与表格换行
    const convertToMd = (mammoth as any).convertToMarkdown || (mammoth as any).default?.convertToMarkdown;
    if (convertToMd) {
      const result = await convertToMd({ arrayBuffer });
      if (result && result.value && result.value.trim().length > 20) {
        return result.value;
      }
    }
  } catch (e) {
    console.warn('[OpenJobFill] mammoth.convertToMarkdown failed, falling back to rawText:', e);
  }

  try {
    // 2. 回退到提取原始纯文本
    const extractFn = (mammoth as any).extractRawText || (mammoth as any).default?.extractRawText;
    if (extractFn) {
      const result = await extractFn({ arrayBuffer });
      if (result && result.value) {
        return result.value;
      }
    }
  } catch (e: any) {
    throw new Error(`Word 文件解析失败: ${e?.message || '未知错误'}`);
  }

  return '';
}
