export const MAX_FILE_BYTES = 20_000_000;
export type FileCategory = 'photo' | 'quote' | 'audio' | 'receipt';
const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif'];
const audioTypes = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-m4a', 'audio/x-wav'];
const documentTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
const byExtension: Record<string, string> = {
  jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp', heic:'image/heic', heif:'image/heif', gif:'image/gif',
  pdf:'application/pdf', xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls:'application/vnd.ms-excel',
  m4a:'audio/mp4', mp3:'audio/mpeg', wav:'audio/wav', ogg:'audio/ogg', webm:'audio/webm'
};
export const photoAccept = '.jpg,.jpeg,.png,.webp,.heic,.heif,.gif,image/jpeg,image/png,image/webp,image/heic,image/heif,image/gif';
export const quoteAccept = photoAccept + ',.pdf,.xlsx,.xls,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';
export function classifyUpload(file: { name:string; type:string; size:number }, requested?:string): { type:string; category:FileCategory } {
  if (!file.size) throw new Error('빈 파일은 업로드할 수 없어요.');
  if (file.size > MAX_FILE_BYTES) throw new Error('파일은 한 개당 20MB 이하로 올려 주세요.');
  let type = file.type.split(';')[0].trim().toLowerCase();
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (!type || type === 'application/octet-stream') type = byExtension[extension] || '';
  const category = requested || (imageTypes.includes(type) ? 'photo' : audioTypes.includes(type) ? 'audio' : '');
  const allowed = category === 'receipt' ? ['image/jpeg','image/png','image/webp'] : category === 'quote' ? [...imageTypes, ...documentTypes] : category === 'photo' ? imageTypes : category === 'audio' ? audioTypes : [];
  if (!allowed.includes(type)) throw new Error(category === 'receipt' ? '영수증은 JPG, PNG, WEBP 사진으로 올려 주세요.' : category === 'quote' ? '견적서는 PDF, 사진, 엑셀(.xlsx, .xls) 파일로 올려 주세요.' : category === 'photo' ? 'JPG, PNG, WEBP, HEIC, GIF 사진을 올려 주세요.' : '지원하지 않는 파일 형식이에요.');
  return { type, category: category as FileCategory };
}
