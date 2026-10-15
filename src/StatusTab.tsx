import { useEffect, useState } from 'react';
import { rawUrl, type RepoConfig } from './github';
import { readManualExpiry, readSiteUrl, saveManualExpiry, saveSiteUrl } from './storage';

type Check = { state: 'idle' | 'checking' | 'ok' | 'warn' | 'fail'; lines: string[] };

/** 키 만료까지 남은 날 (모르면 null) */
export function daysLeft(expiresAt: string, now = Date.now()) {
  if (!expiresAt) return null;
  const t = Date.parse(expiresAt);
  return Number.isNaN(t) ? null : Math.floor((t - now) / 86400000);
}

export function StatusTab({
  config,
  expiresAt,
  noticeCount,
}: {
  config: RepoConfig;
  expiresAt: string;
  noticeCount: number;
}) {
  const [site, setSite] = useState(readSiteUrl);
  const [check, setCheck] = useState<Check>({ state: 'idle', lines: [] });
  const [manual, setManual] = useState(readManualExpiry);
  const [copied, setCopied] = useState(false);

  const run = async (target = site) => {
    const base = target.trim().replace(/\/+$/, '');
    if (!/^https?:\/\//.test(base)) {
      setCheck({
        state: 'fail',
        lines: ['https:// 로 시작하는 사용자 사이트 주소를 넣어 주세요.'],
      });
      return;
    }
    saveSiteUrl(base);
    setCheck({
      state: 'checking',
      lines: ['확인하고 있어요… (서버가 잠들어 있으면 1분 정도 걸려요)'],
    });
    const lines: string[] = [];
    let state: Check['state'] = 'ok';
    try {
      const health = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(70000) });
      const h = (await health.json()) as {
        ok?: boolean;
        noticesConfigured?: boolean;
        ai?: Record<string, boolean>;
      };
      if (!health.ok || !h.ok) throw new Error();
      lines.push('✅ 사용자 사이트 서버가 켜져 있어요.');
      if (!h.noticesConfigured) {
        state = 'warn';
        lines.push(
          '⚠️ 서버에 공지 주소(NOTICES_URL)가 아직 설정되지 않았어요. 아래 주소를 넣어 주세요.',
        );
      } else {
        const res = await fetch(`${base}/api/notices`, { signal: AbortSignal.timeout(20000) });
        const n = (await res.json()) as { items?: unknown[] };
        if (res.ok && Array.isArray(n.items)) {
          lines.push(
            `✅ 공지 연결됨: 지금 사용자 화면에 공지 ${n.items.length}개가 보여요 (관리 목록 ${noticeCount}개, 기간 밖 공지는 빠짐).`,
          );
        } else {
          state = 'warn';
          lines.push('⚠️ 공지 파일을 읽지 못했어요. NOTICES_URL 주소가 맞는지 확인해 주세요.');
        }
      }
      const ai = Object.entries(h.ai ?? {})
        .filter(([, v]) => v)
        .map(([k]) => k);
      lines.push(
        ai.length
          ? `ℹ️ AI 사용 가능: ${ai.join(', ')}`
          : 'ℹ️ AI 모델 이름이 설정되지 않아 AI 기능은 꺼져 있어요(선택 사항).',
      );
    } catch {
      state = 'fail';
      lines.push(
        '❌ 사용자 사이트에 연결하지 못했어요. 주소가 맞는지, Render에 배포가 끝났는지 확인해 주세요.',
      );
    }
    setCheck({ state, lines });
  };
  useEffect(() => {
    if (site) void run(site);
    // 처음 열 때 한 번만 자동 확인
  }, []);

  const effectiveExpiry =
    expiresAt || (manual ? new Date(`${manual}T23:59:59+09:00`).toISOString() : '');
  const left = daysLeft(effectiveExpiry);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(rawUrl(config));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="stack">
      <section className="card">
        <h2>사용자 사이트 연결 상태</h2>
        <div className="row">
          <label className="field grow">
            <span>사용자 사이트 주소 (Render)</span>
            <input
              type="url"
              value={site}
              placeholder="https://story-dam-ieum.onrender.com"
              onChange={(e) => setSite(e.target.value)}
            />
          </label>
          <button
            className="primary align-end"
            onClick={() => void run()}
            disabled={check.state === 'checking'}
          >
            {check.state === 'checking' ? '확인 중…' : '연결 확인'}
          </button>
        </div>
        {check.lines.length > 0 && (
          <ul className={`status-lines ${check.state}`} role="status">
            {check.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
        <h3>공지 파일 주소 (NOTICES_URL)</h3>
        <p className="muted small">
          Render의 사용자 사이트 설정(Environment)에 <code>NOTICES_URL</code> 이름으로 이 주소를
          넣으면 공지가 연결돼요.
        </p>
        <div className="row">
          <code className="url">{rawUrl(config)}</code>
          <button className="ghost" onClick={() => void copy()}>
            {copied ? '복사했어요' : '주소 복사'}
          </button>
        </div>
      </section>
      <section className="card">
        <h2>출입 키 만료일</h2>
        {expiresAt ? (
          <p>
            깃허브가 알려 준 만료일: <b>{new Date(expiresAt).toLocaleString('ko-KR')}</b>
            {left !== null && ` (${left < 0 ? '만료됨' : `${left}일 남음`})`}
          </p>
        ) : (
          <>
            <p className="muted">
              깃허브가 이 화면에 만료일을 알려 주지 않았어요. 키를 만들 때 정한 만료일을 적어 두면
              7일 전부터 알려 드려요. (이 브라우저에만 기억)
            </p>
            <label className="field narrow">
              <span>키 만료일</span>
              <input
                type="date"
                value={manual}
                onChange={(e) => {
                  setManual(e.target.value);
                  saveManualExpiry(e.target.value);
                }}
              />
            </label>
            {left !== null && <p>{left < 0 ? '만료일이 지났어요.' : `${left}일 남았어요.`}</p>}
          </>
        )}
        <p className="muted small">
          키를 새로 만들려면: 깃허브 → Settings → Developer settings → Personal access tokens →
          Fine-grained tokens. 기존 키의 <b>Regenerate token</b>을 누르면 권한은 그대로 두고 기간만
          늘릴 수 있어요.
        </p>
      </section>
    </div>
  );
}
