import { AllowedFileMime, BLUEPRINT_LIMITS } from '../types/itinerary';

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Não foi possível ler o arquivo.'));
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo selecionado.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Imagem inválida ou corrompida.'));
    img.src = src;
  });
}

export async function compressImageToDataUrl(
  file: File,
  maxWidth: number,
  maxDataUrlChars: number
): Promise<{ dataUrl: string; mimeType: AllowedFileMime; sizeBytes: number }> {
  const rawUrl = await readFileAsDataUrl(file);
  const img = await loadImage(rawUrl);

  const scale = img.width > maxWidth ? maxWidth / img.width : 1;
  const targetW = Math.max(1, Math.round(img.width * scale));
  const targetH = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Navegador sem suporte a processamento de imagem.');
  ctx.drawImage(img, 0, 0, targetW, targetH);

  let quality = 0.84;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length > maxDataUrlChars && quality > 0.35) {
    quality -= 0.12;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }

  if (dataUrl.length > maxDataUrlChars) {
    throw new Error('A imagem é muito grande mesmo após compressão. Escolha outra imagem.');
  }

  const base64Len = dataUrl.split(',')[1]?.length ?? 0;
  const sizeBytes = Math.max(1, Math.round((base64Len * 3) / 4));

  return {
    dataUrl,
    mimeType: 'image/jpeg',
    sizeBytes,
  };
}

export async function prepareAttachmentFile(file: File): Promise<{
  name: string;
  mimeType: AllowedFileMime;
  sizeBytes: number;
  dataUrl: string;
}> {
  const cleanName = (file.name || 'arquivo').trim().slice(0, BLUEPRINT_LIMITS.FILE_NAME_MAX);

  if (file.type === 'application/pdf') {
    if (file.size > BLUEPRINT_LIMITS.FILE_BYTES_MAX) {
      throw new Error(
        `O PDF "${cleanName}" excede o limite de ${Math.round(
          BLUEPRINT_LIMITS.FILE_BYTES_MAX / 1000
        )} KB.`
      );
    }
    const dataUrl = await readFileAsDataUrl(file);
    if (dataUrl.length > BLUEPRINT_LIMITS.FILE_DATAURL_MAX) {
      throw new Error(`O PDF "${cleanName}" excede o tamanho máximo suportado.`);
    }
    return {
      name: cleanName,
      mimeType: 'application/pdf',
      sizeBytes: Math.max(1, file.size),
      dataUrl,
    };
  }

  if (file.type.startsWith('image/')) {
    const compressed = await compressImageToDataUrl(
      file,
      1400,
      BLUEPRINT_LIMITS.FILE_DATAURL_MAX
    );
    return {
      name: cleanName,
      mimeType: compressed.mimeType,
      sizeBytes: compressed.sizeBytes,
      dataUrl: compressed.dataUrl,
    };
  }

  throw new Error('Formato não suportado. Envie apenas arquivos PDF ou imagens.');
}
