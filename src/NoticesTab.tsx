import { useMemo, useState, type FormEvent } from 'react';
import type { NoticeItem } from './github';
import { RichText } from './RichText';

const newId = () => `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const today = () => new Date().toISOString().slice(0, 10);
const dateLabel = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('ko-KR') : '');
// 날짜(YYYY-MM-DD)를 한국 시간 기준 시각으로 바꿉니다. 끝나는 날은 그날 밤 11:59까지.
const kstStart = (d: string) => new Date(`${d}T00:00:00+09:00`).toISOString();
const kstEnd = (d: string) => new Date(`${d}T23:59:59+09:00`).toISOString();
const kstDate = (iso?: string) =>
  iso ? new Date(Date.parse(iso) + 9 * 3600000).toISOString().slice(0, 10) : '';

/** 지금 사용자에게 보이는지 */
export function scheduleState(n: NoticeItem, now = Date.now()) {
  if (n.startAt && Date.parse(n.startAt) > now) return 'scheduled' as const;
  if (n.endAt && Date.parse(n.endAt) < now) return 'ended' as const;
  return 'live' as const;
}
const STATE_LABEL = { scheduled: '예약', ended: '기간 끝남', live: '' };

type Draft = {
  title: string;
  body: string;
  urgent: boolean;
  date: string;
  start: string;
  end: string;
};
const emptyDraft = (): Draft => ({
  title: '',
  body: '',
  urgent: false,
  date: today(),
  start: '',
  end: '',
});

export function NoticesTab({
  notices,
  setNotices,
  loading,
  onInfo,
}: {
  notices: NoticeItem[];
  setNotices: (next: NoticeItem[]) => void;
  loading: boolean;
  onInfo: (text: string) => void;
}) {
  const [selected, setSelected] = useState<string | 'new'>('new');
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const sorted = useMemo(
    () =>
      [...notices].sort(
        (a, b) =>
          Number(b.urgent) - Number(a.urgent) ||
          Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
      ),
    [notices],
  );
  const periodError = draft.start && draft.end && draft.start > draft.end;

  function pick(id: string | 'new', list = notices) {
    setSelected(id);
    setConfirmDelete(false);
    const n = list.find((x) => x.id === id);
    setDraft(
      n
        ? {
            title: n.title,
            body: n.body,
            urgent: n.urgent,
            date: n.publishedAt.slice(0, 10),
            start: kstDate(n.startAt),
            end: kstDate(n.endAt),
          }
        : emptyDraft(),
    );
  }

  const apply = (e: FormEvent) => {
    e.preventDefault();
    if (periodError) return;
    const item: NoticeItem = {
      id: selected === 'new' ? newId() : selected,
      title: draft.title.trim(),
      body: draft.body.trim(),
      urgent: draft.urgent,
      publishedAt: new Date(`${draft.date}T09:00:00+09:00`).toISOString(),
      ...(draft.start ? { startAt: kstStart(draft.start) } : {}),
      ...(draft.end ? { endAt: kstEnd(draft.end) } : {}),
    };
    const next =
      selected === 'new' ? [...notices, item] : notices.map((n) => (n.id === selected ? item : n));
    setNotices(next);
    pick(item.id, next);
    onInfo('목록에 반영했어요. "깃허브에 저장"을 눌러야 사용자 사이트에 보여요.');
  };

  const remove = () => {
    if (!confirmDelete) return setConfirmDelete(true);
    const next = notices.filter((n) => n.id !== selected);
    setNotices(next);
    pick('new', next);
    onInfo('목록에서 지웠어요. "깃허브에 저장"을 눌러야 실제로 지워져요.');
  };

  return (
    <div className="columns">
      <section className="card list" aria-label="공지 목록">
        <button
          className={`item new ${selected === 'new' ? 'active' : ''}`}
          onClick={() => pick('new')}
        >
          + 새 공지 쓰기
        </button>
        {loading ? (
          <p className="muted small pad">불러오는 중…</p>
        ) : sorted.length ? (
          sorted.map((n) => {
            const state = scheduleState(n);
            return (
              <button
                key={n.id}
                className={`item ${selected === n.id ? 'active' : ''} ${state}`}
                onClick={() => pick(n.id)}
              >
                <strong>
                  {n.urgent && <span className="tag">중요</span>}
                  {state !== 'live' && <span className="tag muted-tag">{STATE_LABEL[state]}</span>}
                  {n.title}
                </strong>
                <span className="muted small">{dateLabel(n.publishedAt)}</span>
              </button>
            );
          })
        ) : (
          <p className="muted small pad">공지가 없어요.</p>
        )}
      </section>
      <section className="card">
        <form onSubmit={apply}>
          <h2>{selected === 'new' ? '새 공지' : '공지 수정'}</h2>
          <label className="field">
            <span>제목</span>
            <input
              value={draft.title}
              maxLength={180}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              required
            />
          </label>
          <label className="field">
            <span>내용</span>
            <textarea
              rows={8}
              value={draft.body}
              maxLength={10000}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            />
          </label>
          <p className="muted small hint">
            <code>**굵게**</code>처럼 별표 두 개로 감싸면 굵은 글씨, <code>https://</code>로
            시작하는 주소는 자동으로 링크가 돼요.
          </p>
          <div className="grid2">
            <label className="field">
              <span>게시일</span>
              <input
                type="date"
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                required
              />
            </label>
            <label className="check boxed">
              <input
                type="checkbox"
                checked={draft.urgent}
                onChange={(e) => setDraft({ ...draft, urgent: e.target.checked })}
              />
              중요 공지 (맨 위에 펼쳐서 표시)
            </label>
            <label className="field">
              <span>보이기 시작하는 날 (선택)</span>
              <input
                type="date"
                value={draft.start}
                onChange={(e) => setDraft({ ...draft, start: e.target.value })}
              />
            </label>
            <label className="field">
              <span>보이는 마지막 날 (선택)</span>
              <input
                type="date"
                value={draft.end}
                onChange={(e) => setDraft({ ...draft, end: e.target.value })}
              />
            </label>
          </div>
          {periodError && (
            <p className="alert" role="alert">
              마지막 날이 시작하는 날보다 앞이에요.
            </p>
          )}
          <p className="muted small hint">
            기간을 비워 두면 계속 보여요. 기간이 지난 공지도 파일에는 남아 있으니, 필요 없으면
            삭제하세요.
          </p>
          <div className="row">
            <button className="primary" disabled={!draft.title.trim() || !!periodError}>
              {selected === 'new' ? '목록에 추가' : '수정 내용 반영'}
            </button>
            {selected !== 'new' && (
              <button type="button" className={confirmDelete ? 'danger' : 'ghost'} onClick={remove}>
                {confirmDelete ? '정말 지울까요? 한 번 더 누르기' : '삭제'}
              </button>
            )}
          </div>
        </form>
        <div className="preview" aria-label="사용자 화면 미리보기">
          <p className="muted small">사용자 화면 미리보기</p>
          <p className="preview-title">
            {draft.urgent ? '중요 · ' : ''}
            {draft.title || '제목'}{' '}
            <span className="muted small">{dateLabel(`${draft.date}T09:00:00+09:00`)}</span>
          </p>
          <RichText text={draft.body || '내용'} />
        </div>
      </section>
    </div>
  );
}
