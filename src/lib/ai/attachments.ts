import type { LabAttachment } from '../types.ts';

export const MAX_LAB_ATTACHMENTS = 3;
export const MAX_TEXT_FILE_BYTES = 150 * 1024; // 150 KB for text/markdown/csv/json
export const MAX_BINARY_FILE_BYTES = 4 * 1024 * 1024; // 4 MB for images & PDF
export const MAX_EXTRACTED_TEXT_CHARS = 24_000;

export const ALLOWED_TEXT_MIME_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
]);

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
]);

export const ALLOWED_PDF_MIME_TYPES = new Set(['application/pdf']);

const EXTENSION_MIME_FALLBACK: Record<string, string> = {
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

export interface AttachmentValidationResult {
  ok: boolean;
  kind?: LabAttachment['kind'];
  mimeType?: string;
  error?: string;
}

export function inferAttachmentMimeType(name: string, declaredType?: string): string {
  const cleanDeclared = (declaredType || '').trim().toLowerCase();
  if (
    ALLOWED_TEXT_MIME_TYPES.has(cleanDeclared) ||
    ALLOWED_IMAGE_MIME_TYPES.has(cleanDeclared) ||
    ALLOWED_PDF_MIME_TYPES.has(cleanDeclared)
  ) {
    return cleanDeclared;
  }

  const lowerName = (name || '').trim().toLowerCase();
  const dotIdx = lowerName.lastIndexOf('.');
  if (dotIdx !== -1) {
    const ext = lowerName.slice(dotIdx);
    if (EXTENSION_MIME_FALLBACK[ext]) {
      return EXTENSION_MIME_FALLBACK[ext];
    }
  }

  return cleanDeclared;
}

export function validateAttachmentFile(
  file: { name: string; type?: string; size: number },
  existingCount = 0
): AttachmentValidationResult {
  if (existingCount >= MAX_LAB_ATTACHMENTS) {
    return {
      ok: false,
      error: `Mỗi lượt chỉ đính kèm tối đa ${MAX_LAB_ATTACHMENTS} tệp để đảm bảo tốc độ phân tích.`,
    };
  }

  const mimeType = inferAttachmentMimeType(file.name, file.type);

  if (ALLOWED_TEXT_MIME_TYPES.has(mimeType)) {
    if (file.size > MAX_TEXT_FILE_BYTES) {
      return {
        ok: false,
        error: `Tệp văn bản "${file.name}" vượt quá giới hạn 150 KB.`,
      };
    }
    return { ok: true, kind: 'text', mimeType };
  }

  if (ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    if (file.size > MAX_BINARY_FILE_BYTES) {
      return {
        ok: false,
        error: `Ảnh "${file.name}" vượt quá giới hạn 4 MB.`,
      };
    }
    return { ok: true, kind: 'image', mimeType };
  }

  if (ALLOWED_PDF_MIME_TYPES.has(mimeType)) {
    if (file.size > MAX_BINARY_FILE_BYTES) {
      return {
        ok: false,
        error: `Tệp PDF "${file.name}" vượt quá giới hạn 4 MB.`,
      };
    }
    return { ok: true, kind: 'pdf', mimeType };
  }

  return {
    ok: false,
    error: `Định dạng tệp "${file.name}" chưa được hỗ trợ. Chỉ chấp nhận .txt, .md, .csv, .json, .png, .jpg, .webp và .pdf.`,
  };
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error(`Không thể đọc tệp văn bản "${file.name}".`));
    reader.readAsText(file, 'utf-8');
  });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error(`Không thể đọc tệp "${file.name}".`));
    reader.readAsDataURL(file);
  });
}

export async function readAttachmentFile(
  file: File,
  existingCount = 0
): Promise<LabAttachment> {
  const validation = validateAttachmentFile(file, existingCount);
  if (!validation.ok || !validation.kind || !validation.mimeType) {
    throw new Error(validation.error || 'Tệp đính kèm không hợp lệ.');
  }

  const id = `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  if (validation.kind === 'text') {
    const rawText = await readAsText(file);
    const trimmedText = rawText.trim().slice(0, MAX_EXTRACTED_TEXT_CHARS);
    if (!trimmedText) {
      throw new Error(`Tệp "${file.name}" đang trống, không có nội dung để phân tích.`);
    }
    return {
      id,
      name: file.name,
      mimeType: validation.mimeType,
      size: file.size,
      kind: 'text',
      textContent: trimmedText,
    };
  }

  const dataUrl = await readAsDataUrl(file);
  const commaIdx = dataUrl.indexOf(',');
  const base64Data = commaIdx !== -1 ? dataUrl.slice(commaIdx + 1) : '';
  if (!base64Data) {
    throw new Error(`Không thể mã hóa tệp "${file.name}".`);
  }

  return {
    id,
    name: file.name,
    mimeType: validation.mimeType,
    size: file.size,
    kind: validation.kind,
    base64Data,
    previewUrl: validation.kind === 'image' ? dataUrl : undefined,
  };
}

export function toApiAttachments(attachments?: LabAttachment[]) {
  if (!attachments || attachments.length === 0) return undefined;
  return attachments.slice(0, MAX_LAB_ATTACHMENTS).map((att) => ({
    name: att.name,
    mimeType: att.mimeType,
    textContent: att.kind === 'text' ? att.textContent : undefined,
    base64Data: att.kind !== 'text' ? att.base64Data : undefined,
  }));
}

export function formatAttachmentsContextSummary(attachments?: LabAttachment[]): string {
  if (!attachments || attachments.length === 0) return '';
  return attachments
    .map((att, idx) => {
      if (att.kind === 'text' && att.textContent) {
        const snippet = att.textContent.slice(0, 600).replace(/\s+/g, ' ').trim();
        return `[Tệp ${idx + 1}: ${att.name} (${att.mimeType}) — trích nội dung]: ${snippet}`;
      }
      const label = att.kind === 'image' ? 'Hình ảnh đính kèm' : 'Tài liệu PDF đính kèm';
      return `[Tệp ${idx + 1}: ${att.name} (${label}, ${formatFileSize(att.size)})]`;
    })
    .join('\n');
}
