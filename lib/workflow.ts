import type { Item } from './domain';

export function speechErrorMessage(error: string) {
  const messages: Record<string, string> = {
    'not-allowed': '마이크 또는 음성 인식 권한이 차단되어 있어요. 브라우저의 사이트 권한을 허용하거나 키보드의 마이크로 입력해 주세요.',
    'service-not-allowed': '이 브라우저에서 받아쓰기 서비스를 사용할 수 없어요. 아이폰은 Safari에서 열거나 키보드의 마이크로 입력해 주세요.',
    'audio-capture': '마이크를 사용할 수 없어요. 통화나 다른 녹음을 종료한 뒤 다시 시도해 주세요.',
    'network': '음성 인식 서비스에 연결하지 못했어요. 연결을 확인하거나 키보드로 입력해 주세요. 작성한 내용은 유지됩니다.',
    'no-speech': '목소리를 듣지 못했어요. 다시 누르고 마이크 가까이에서 말해 주세요.',
    'language-not-supported': '이 브라우저는 한국어 받아쓰기를 지원하지 않아요. 키보드의 음성 입력을 이용해 주세요.',
  };
  return messages[error] || '받아쓰기를 사용할 수 없어요. 키보드의 마이크 또는 직접 입력을 이용해 주세요.';
}

// Copy only work items; customer and supplier data stay with the destination quote.
export function reusableItems(items: Item[]): Item[] {
  return items.map(({ name, unit, qty, price, memo }) => ({ name, unit, qty, price, memo }));
}
