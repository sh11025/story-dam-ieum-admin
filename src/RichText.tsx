import type { ReactNode } from 'react';

// 사용자 사이트와 같은 규칙: **굵게** 와 인터넷 주소 링크만 꾸밉니다.
// 다른 코드(HTML 등)는 그대로 글자로 보여서 위험한 내용이 실행되지 않습니다.
const TOKEN = /(\*\*[^*\n]+\*\*|https?:\/\/[^\s<>"')\]]+)/g;

export function RichText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index! > last) parts.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith('**')) parts.push(<strong key={m.index}>{token.slice(2, -2)}</strong>);
    else
      parts.push(
        <a key={m.index} href={token} target="_blank" rel="noopener noreferrer">
          {token}
        </a>,
      );
    last = m.index! + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <p className="prewrap">{parts}</p>;
}
