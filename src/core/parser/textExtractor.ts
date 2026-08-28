/**
 * 从 File 或 Blob 对象中提取纯文本内容 (支持 .pdf, .docx, .txt, .md)
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.pdf')) {
    return extractTextFromPdf(file);
  } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
    return extractTextFromDocx(file);
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
    const textContent = await page.getTextContent();
    
    // 按行/项合并文本
    let lastY: number | null = null;
    let pageStr = '';

    for (const item of textContent.items as any[]) {
      if (!item.str) continue;
      
      // 如果垂直坐标变化明显，插入换行符保持简历排版结构
      if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
        pageStr += '\n';
      } else if (pageStr.length > 0 && !pageStr.endsWith(' ') && !pageStr.endsWith('\n')) {
        pageStr += ' ';
      }

      pageStr += item.str;
      lastY = item.transform[5];
    }

    pageTexts.push(pageStr);
  }

  return pageTexts.join('\n\n');
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
    if (file instanceof File && file.name.toLowerCase().endsWith('.doc')) {
      throw new Error('检测到为早期 Word 97-2003 (.doc) 格式，建议在 Word 中另存为 .docx 或 .pdf 后导入以获得最佳识别精度');
    }
    throw new Error(`Word 文件解析失败: ${e?.message || '未知错误'}`);
  }

  return '';
}

