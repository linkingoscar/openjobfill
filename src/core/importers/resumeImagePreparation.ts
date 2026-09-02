const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_EDGE = 2200;

export function validateResumeImageFile(file: Pick<File, 'type' | 'size'>): void {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) throw new Error('请选择 JPG、PNG 或 WebP 简历图片');
  if (file.size <= 0) throw new Error('图片文件为空');
  if (file.size > MAX_SOURCE_BYTES) throw new Error('原始图片不能超过 12 MB');
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('读取简历图片失败'));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('无法解码简历图片'));
    image.src = dataUrl;
  });
}

/** 压到视觉模型足够清晰且适合扩展消息传输的尺寸。 */
export async function prepareResumeImage(file: File): Promise<string> {
  validateResumeImageFile(file);
  const source = await readDataUrl(file);
  const image = await loadImage(source);
  const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('浏览器无法处理图片画布');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  const result = canvas.toDataURL('image/jpeg', 0.9);
  if (result.length > 12_000_000) throw new Error('处理后的图片仍然过大，请先压缩图片');
  return result;
}
