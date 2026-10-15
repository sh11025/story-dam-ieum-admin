import { useEffect, useState } from 'react';
import { loadContent, saveContent, verifyAccess, type Content } from './github';
import { Login, type Session } from './Login';
import { NoticesTab } from './NoticesTab';
import { FaqTab } from './FaqTab';
import { HistoryTab } from './HistoryTab';
import { StatusTab, daysLeft } from './StatusTab';
import { readConfig, readManualExpiry, readToken, saveToken } from './storage';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [autoTried, setAutoTried] = useState(false);

  // 이 탭에서 기억한 키가 있으면 자동으로 다시 연결합니다.
  useEffect(() => {
    const token = readToken();
    const config = readConfig();
    if (!token || !config.owner || !config.repo) return setAutoTried(true);
    verifyAccess(token, config)
      .then((r) => setSession({ token, login: r.login, config, expiresAt: r.expiresAt }))
      .catch(() => saveToken(''))
      .finally(() => setAutoTried(true));
  }, []);

  const logout = () => {
    saveToken('');
    setSession(null);
  };

  return (
    <>
      <header className="top">
        <div className="brand">
          <span className="mark" aria-hidden="true" />
          <span>
            Story Dam Ieum <small>관리자</small>
          </span>
        </div>
        {session && (
          <div className="who">
            <span>{session.login}</span>
            <button className="ghost" onClick={logout}>
              로그아웃
            </button>
          </div>
        )}
      </header>
      <main id="main">
        {session ? (
          <Workspace session={session} />
        ) : autoTried ? (
          <Login onLogin={setSession} />
        ) : (
          <p role="status" className="center">
            연결을 확인하고 있어요…
          </p>
        )}
      </main>
    </>
  );
}

const TABS = ['공지', '자주 묻는 질문', '수정 기록', '연결 상태'] as const;
type Tab = (typeof TABS)[number];
const EMPTY: Content = { notices: [], faqs: null };

function Workspace({ session }: { session: Session }) {
  const { token, config } = session;
  const [tab, setTab] = useState<Tab>('공지');
  const [content, setContent] = useState<Content>(EMPTY);
  const [savedJson, setSavedJson] = useState(JSON.stringify(EMPTY));
  const [sha, setSha] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  const dirty = JSON.stringify(content) !== savedJson;
  const expiry =
    session.expiresAt ||
    (readManualExpiry() ? new Date(`${readManualExpiry()}T23:59:59+09:00`).toISOString() : '');
  const left = daysLeft(expiry);

  const reload = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const loaded = await loadContent(token, config);
      setContent(loaded.content);
      setSavedJson(JSON.stringify(loaded.content));
      setSha(loaded.sha);
      if (!loaded.sha)
        setStatus({ text: '아직 공지 파일이 없어요. 첫 공지를 저장하면 파일이 만들어져요.' });
    } catch (e) {
      setStatus({ text: (e as Error).message, error: true });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => void reload(), []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      // 질문이 빈 줄은 저장하지 않습니다.
      const clean: Content = {
        notices: content.notices,
        faqs: content.faqs
          ? content.faqs
              .filter((f) => f.question.trim())
              .map((f) => ({ ...f, question: f.question.trim(), answer: f.answer.trim() }))
          : null,
      };
      const result = await saveContent(
        token,
        config,
        clean,
        sha,
        `공지 수정 (공지 ${clean.notices.length}개${clean.faqs ? `, 질문 ${clean.faqs.length}개` : ''})`,
      );
      setSha(result.sha);
      setContent(clean);
      setSavedJson(JSON.stringify(clean));
      setHistoryKey((k) => k + 1);
      setStatus({ text: '깃허브에 저장했어요. 사용자 사이트에는 몇 분 안에 반영돼요.' });
    } catch (e) {
      setStatus({ text: (e as Error).message, error: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="workspace">
      {left !== null && left <= 7 && (
        <p className="alert" role="alert">
          {left < 0
            ? '깃허브 출입 키가 만료됐어요. 새 키를 만들어 다시 로그인해 주세요.'
            : `깃허브 출입 키가 ${left}일 뒤 만료돼요. "연결 상태" 탭의 안내대로 미리 연장해 주세요.`}
        </p>
      )}
      <div className="toolbar">
        <div>
          <h1>공지 관리</h1>
          <p className="muted small">
            {config.owner}/{config.repo} · {config.path}
          </p>
        </div>
        <div className="toolbar-actions">
          {dirty && <span className="badge">저장하지 않은 변경 있음</span>}
          <button className="ghost" onClick={() => void reload()} disabled={loading || saving}>
            새로 불러오기
          </button>
          <button
            className="primary"
            onClick={() => void save()}
            disabled={!dirty || saving || loading}
          >
            {saving ? '저장하는 중…' : '깃허브에 저장'}
          </button>
        </div>
      </div>
      <nav className="tabs" aria-label="관리 메뉴">
        {TABS.map((t) => (
          <button
            key={t}
            className={tab === t ? 'active' : ''}
            aria-current={tab === t ? 'page' : undefined}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>
      {status && (
        <p className={status.error ? 'alert' : 'info'} role={status.error ? 'alert' : 'status'}>
          {status.text}
        </p>
      )}
      {tab === '공지' && (
        <NoticesTab
          notices={content.notices}
          setNotices={(notices) => setContent((c) => ({ ...c, notices }))}
          loading={loading}
          onInfo={(text) => setStatus({ text })}
        />
      )}
      {tab === '자주 묻는 질문' && (
        <FaqTab faqs={content.faqs} setFaqs={(faqs) => setContent((c) => ({ ...c, faqs }))} />
      )}
      {tab === '수정 기록' && (
        <HistoryTab
          key={historyKey}
          token={token}
          config={config}
          dirty={dirty}
          onRestore={(restored, label) => {
            setContent(restored);
            setTab('공지');
            setStatus({
              text: `${label} 상태로 되돌렸어요. "깃허브에 저장"을 눌러야 실제로 반영돼요.`,
            });
          }}
        />
      )}
      {tab === '연결 상태' && (
        <StatusTab
          config={config}
          expiresAt={session.expiresAt}
          noticeCount={content.notices.length}
        />
      )}
    </div>
  );
}
