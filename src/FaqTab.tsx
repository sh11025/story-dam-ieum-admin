import { useState } from 'react';
import type { FaqItem } from './github';
import { RichText } from './RichText';

// 사용자 사이트에 원래 들어 있는 기본 질문 (파일에 질문이 없을 때 보이는 것)
export const DEFAULT_FAQS: FaqItem[] = [
  {
    id: 'where',
    question: '작업은 어디에 저장되나요?',
    answer:
      '취업 작업 데이터는 이 기기의 브라우저에만 저장되고 서버로 보내지 않습니다. 오래 보관하거나 다른 기기에서 이어 쓰려면 .sdi 파일로 저장해 주세요.',
  },
  {
    id: 'url',
    question: '공고 주소로 가져오기가 안 돼요.',
    answer:
      '일부 채용 사이트는 자동으로 내용을 가져가는 것을 막거나, 공고를 그림으로 올려 둡니다. 이럴 때는 공고 내용을 복사해 "공고 붙여넣기"에 넣어 주세요.',
  },
];
const newId = () => `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export function FaqTab({
  faqs,
  setFaqs,
}: {
  faqs: FaqItem[] | null;
  setFaqs: (next: FaqItem[] | null) => void;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  if (!faqs)
    return (
      <section className="card">
        <h2>자주 묻는 질문</h2>
        <p className="muted">
          지금은 사용자 사이트에 들어 있는 <b>기본 질문 {DEFAULT_FAQS.length}개</b>가 보이고 있어요.
          여기서 고치기 시작하면, 저장한 뒤부터는 이 화면의 질문이 대신 보여요.
        </p>
        <ul className="faq-preview">
          {DEFAULT_FAQS.map((f) => (
            <li key={f.id}>{f.question}</li>
          ))}
        </ul>
        <button className="primary" onClick={() => setFaqs(structuredClone(DEFAULT_FAQS))}>
          기본 질문으로 시작해서 고치기
        </button>
      </section>
    );

  const change = (i: number, patch: Partial<FaqItem>) =>
    setFaqs(faqs.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const move = (i: number, d: number) => {
    const next = [...faqs];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x);
    setFaqs(next);
  };

  return (
    <section className="card">
      <div className="toolbar">
        <h2>자주 묻는 질문 {faqs.length}개</h2>
        <div className="toolbar-actions">
          <button
            className="ghost"
            onClick={() => setFaqs([...faqs, { id: newId(), question: '', answer: '' }])}
            disabled={faqs.length >= 50}
          >
            + 질문 추가
          </button>
          <button
            className={confirmReset ? 'danger' : 'ghost'}
            onClick={() => {
              if (!confirmReset) return setConfirmReset(true);
              setFaqs(null);
              setConfirmReset(false);
            }}
          >
            {confirmReset ? '정말 기본 질문으로 되돌릴까요?' : '기본 질문으로 되돌리기'}
          </button>
        </div>
      </div>
      {faqs.map((f, i) => (
        <div className="faq-row" key={f.id}>
          <label className="field">
            <span>질문 {i + 1}</span>
            <input
              value={f.question}
              maxLength={300}
              onChange={(e) => change(i, { question: e.target.value })}
            />
          </label>
          <label className="field">
            <span>답변 {i + 1}</span>
            <textarea
              rows={3}
              value={f.answer}
              maxLength={5000}
              onChange={(e) => change(i, { answer: e.target.value })}
            />
          </label>
          <details className="faq-look">
            <summary className="muted small">미리보기</summary>
            <RichText text={f.answer || '답변'} />
          </details>
          <div className="row">
            <button className="ghost" disabled={i === 0} onClick={() => move(i, -1)}>
              위로
            </button>
            <button className="ghost" disabled={i === faqs.length - 1} onClick={() => move(i, 1)}>
              아래로
            </button>
            <button
              className="ghost"
              aria-label={`질문 ${i + 1} 삭제`}
              onClick={() => setFaqs(faqs.filter((_, j) => j !== i))}
            >
              삭제
            </button>
          </div>
        </div>
      ))}
      {faqs.some((f) => !f.question.trim()) && (
        <p className="muted small">질문이 비어 있는 줄은 사용자 화면에 보이지 않아요.</p>
      )}
    </section>
  );
}
