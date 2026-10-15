import { useState, type FormEvent } from 'react';
import { verifyAccess, type RepoConfig } from './github';
import { readConfig, saveConfig, saveToken } from './storage';

export type Session = { token: string; login: string; config: RepoConfig; expiresAt: string };

export function Login({ onLogin }: { onLogin: (s: Session) => void }) {
  const [config, setConfig] = useState<RepoConfig>(readConfig);
  const [token, setToken] = useState('');
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showRepo, setShowRepo] = useState(!config.owner || !config.repo);
  const set = (key: keyof RepoConfig) => (v: string) =>
    setConfig((c) => ({ ...c, [key]: v.trim() }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await verifyAccess(token.trim(), config);
      saveConfig(config);
      if (remember) saveToken(token.trim());
      onLogin({ token: token.trim(), login: result.login, config, expiresAt: result.expiresAt });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card login">
      <h1>관리자 로그인</h1>
      <p className="muted">
        깃허브에서 발급한 <strong>출입 키(토큰)</strong>로 로그인해요. 키는 이 화면에만 잠시 두고,
        어디에도 저장하거나 보내지 않아요(깃허브 제외).
      </p>
      <form onSubmit={submit}>
        <label className="field">
          <span>깃허브 출입 키</span>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="github_pat_로 시작하는 키"
            autoComplete="off"
            required
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          이 탭을 닫기 전까지 기억하기 (공용 컴퓨터에서는 사용하지 마세요)
        </label>
        {showRepo ? (
          <fieldset>
            <legend>공지 파일 위치</legend>
            <div className="grid2">
              <Text label="깃허브 사용자 이름" value={config.owner} onChange={set('owner')} />
              <Text label="저장소 이름" value={config.repo} onChange={set('repo')} />
              <Text label="브랜치" value={config.branch} onChange={set('branch')} />
              <Text label="파일 경로" value={config.path} onChange={set('path')} />
            </div>
          </fieldset>
        ) : (
          <p className="muted small">
            공지 파일: {config.owner}/{config.repo} · {config.path}{' '}
            <button type="button" className="link" onClick={() => setShowRepo(true)}>
              바꾸기
            </button>
          </p>
        )}
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        <button
          className="primary full"
          disabled={busy || !token.trim() || !config.owner || !config.repo}
        >
          {busy ? '확인하는 중…' : '로그인'}
        </button>
      </form>
      <details className="help">
        <summary>출입 키는 어떻게 만드나요?</summary>
        <ol>
          <li>
            깃허브 → 오른쪽 위 프로필 → <b>Settings</b> → 맨 아래 <b>Developer settings</b> →{' '}
            <b>Personal access tokens</b> → <b>Fine-grained tokens</b> → <b>Generate new token</b>
          </li>
          <li>
            <b>Repository access</b>에서 <b>Only select repositories</b>를 고르고 이 관리자 저장소만
            선택
          </li>
          <li>
            <b>Permissions</b> → <b>Contents</b>를 <b>Read and write</b>로 설정
          </li>
          <li>만료일을 정하고 만든 뒤, 나온 키를 위 칸에 붙여넣기</li>
        </ol>
        <p className="muted small">
          키가 유출되었다고 생각되면 같은 화면에서 바로 삭제(Revoke)하세요.
        </p>
      </details>
    </section>
  );
}

function Text({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} required />
    </label>
  );
}
