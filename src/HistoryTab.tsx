import { useEffect, useState } from 'react';
import {
  loadContent,
  loadHistory,
  type Content,
  type HistoryEntry,
  type RepoConfig,
} from './github';

const when = (iso: string) => new Date(iso).toLocaleString('ko-KR');

/** 공지 파일이 바뀐 기록을 보고, 원하는 때의 상태로 되돌립니다. */
export function HistoryTab({
  token,
  config,
  onRestore,
  dirty,
}: {
  token: string;
  config: RepoConfig;
  onRestore: (content: Content, label: string) => void;
  dirty: boolean;
}) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState<{ entry: HistoryEntry; content: Content } | null>(null);
  const [busy, setBusy] = useState('');

  const load = () => {
    setError('');
    setEntries(null);
    loadHistory(token, config)
      .then(setEntries)
      .catch((e: Error) => {
        setEntries([]);
        setError(e.message);
      });
  };
  useEffect(load, [token, config]);

  const view = async (entry: HistoryEntry) => {
    setBusy(entry.sha);
    setError('');
    try {
      const { content } = await loadContent(token, config, entry.sha);
      setViewing({ entry, content });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="columns">
      <section className="card list" aria-label="수정 기록">
        <div className="row spread">
          <strong>최근 기록</strong>
          <button className="ghost small-button" onClick={load}>
            새로 고침
          </button>
        </div>
        {entries === null ? (
          <p className="muted small pad">불러오는 중…</p>
        ) : entries.length ? (
          entries.map((e, i) => (
            <button
              key={e.sha}
              className={`item ${viewing?.entry.sha === e.sha ? 'active' : ''}`}
              onClick={() => void view(e)}
              disabled={!!busy}
            >
              <strong>
                {i === 0 && <span className="tag">지금</span>}
                {e.message}
              </strong>
              <span className="muted small">
                {when(e.date)} · {e.author}
              </span>
            </button>
          ))
        ) : (
          <p className="muted small pad">아직 기록이 없어요.</p>
        )}
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
      </section>
      <section className="card">
        {viewing ? (
          <>
            <h2>{when(viewing.entry.date)}의 공지</h2>
            <p className="muted small">
              공지 {viewing.content.notices.length}개 · 자주 묻는 질문{' '}
              {viewing.content.faqs ? `${viewing.content.faqs.length}개` : '기본 질문 사용'}
            </p>
            <ul className="history-list">
              {viewing.content.notices.map((n) => (
                <li key={n.id}>
                  {n.urgent ? '중요 · ' : ''}
                  {n.title}
                </li>
              ))}
            </ul>
            {dirty && (
              <p className="alert" role="alert">
                저장하지 않은 변경이 있어요. 되돌리면 그 변경은 사라져요.
              </p>
            )}
            <div className="row">
              <button
                className="primary"
                onClick={() => onRestore(viewing.content, when(viewing.entry.date))}
              >
                이 상태로 되돌리기
              </button>
            </div>
            <p className="muted small hint">
              되돌리기를 누르면 화면의 목록이 이 상태로 바뀌어요. "깃허브에 저장"을 눌러야 실제로
              반영되고, 지금 상태도 기록에 남아 다시 되돌릴 수 있어요.
            </p>
          </>
        ) : (
          <p className="muted">왼쪽에서 기록을 고르면 그때의 공지 목록을 볼 수 있어요.</p>
        )}
      </section>
    </div>
  );
}
