// 깃허브 저장소에 있는 notices.json 파일을 읽고 저장하는 부분입니다.
// 관리자가 입력한 깃허브 출입 키(토큰)는 이 탭의 메모리(또는 선택 시 탭 저장소)에만 둡니다.

export type NoticeItem = {
  id: string;
  title: string;
  body: string;
  urgent: boolean;
  publishedAt: string;
  startAt?: string; // 이때부터 사용자 화면에 보임 (선택)
  endAt?: string; // 이때까지 보임 (선택)
};
export type FaqItem = { id: string; question: string; answer: string };
/** 공지 파일 전체. faqs가 없으면 사용자 사이트는 기본 질문을 보여 줍니다. */
type NoticeFile = { version: 1; updatedAt: string; notices: NoticeItem[]; faqs?: FaqItem[] };
export type Content = { notices: NoticeItem[]; faqs: FaqItem[] | null };

export type RepoConfig = { owner: string; repo: string; branch: string; path: string };

const API = 'https://api.github.com';

/** 깃허브 페이지 주소(owner.github.io/repo)에서 저장소 정보를 알아냅니다. */
export function guessRepo(loc: Location = window.location): RepoConfig {
  const host = loc.hostname;
  const owner = host.endsWith('.github.io') ? host.split('.')[0] : '';
  const repo = owner ? (loc.pathname.split('/').filter(Boolean)[0] ?? `${owner}.github.io`) : '';
  return { owner, repo, branch: 'main', path: 'data/notices.json' };
}

/** 사용자 사이트(Render)에 NOTICES_URL로 넣을 주소입니다. */
export function rawUrl(c: RepoConfig) {
  return `https://raw.githubusercontent.com/${c.owner}/${c.repo}/${c.branch}/${c.path}`;
}

class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function call<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  return (await callWithHeaders<T>(token, path, init)).data;
}

async function callWithHeaders<T>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<{ data: T; headers: Headers }> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      cache: 'no-store',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'x-github-api-version': '2022-11-28',
        ...(init.body ? { 'content-type': 'application/json' } : {}),
      },
    });
  } catch {
    throw new GitHubError('깃허브에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.', 0);
  }
  if (res.ok) return { data: (await res.json()) as T, headers: res.headers };
  const messages: Record<number, string> = {
    401: '출입 키가 올바르지 않거나 만료되었어요. 새 키를 발급해 주세요.',
    403: '이 출입 키로는 저장소를 고칠 권한이 없어요. 키 설정에서 Contents 권한을 "Read and write"로 해 주세요.',
    404: '저장소나 파일을 찾지 못했어요. 저장소 이름과 키의 저장소 선택을 확인해 주세요.',
    409: '다른 곳에서 공지가 먼저 수정되었어요. 새로 불러온 뒤 다시 저장해 주세요.',
    422: '저장 내용이 올바르지 않아요. 새로 불러온 뒤 다시 시도해 주세요.',
  };
  throw new GitHubError(
    messages[res.status] ?? `깃허브 요청이 실패했어요. (${res.status})`,
    res.status,
  );
}

const toBase64 = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};
const fromBase64 = (b64: string) =>
  new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));

/** 키가 맞는지, 그리고 저장소에 쓸 권한이 있는지 확인합니다. */
export async function verifyAccess(token: string, c: RepoConfig) {
  const { data: user, headers } = await callWithHeaders<{ login: string }>(token, '/user');
  const repo = await call<{
    permissions?: { push?: boolean };
    default_branch: string;
    private: boolean;
  }>(token, `/repos/${c.owner}/${c.repo}`);
  if (!repo.permissions?.push)
    throw new GitHubError(
      '이 출입 키로는 저장소를 고칠 권한이 없어요. Contents 권한을 "Read and write"로 해 주세요.',
      403,
    );
  return {
    login: user.login,
    defaultBranch: repo.default_branch,
    isPrivate: repo.private,
    expiresAt: parseExpiry(headers.get('github-authentication-token-expiration')),
  };
}

/** 깃허브가 알려 주는 키 만료 시각("2026-11-14 12:00:00 UTC" 등)을 읽습니다. 못 읽으면 빈칸. */
export function parseExpiry(value: string | null): string {
  if (!value) return '';
  const iso = value
    .trim()
    .replace(' UTC', 'Z')
    .replace(/^(\d{4}-\d{2}-\d{2}) /, '$1T')
    .replace(/ ([+-]\d{2})(\d{2})$/, '$1:$2');
  const time = Date.parse(iso);
  return Number.isNaN(time) ? '' : new Date(time).toISOString();
}

type LoadedFile = { content: Content; sha: string | null };

function readFile(text: string): Content {
  const parsed = JSON.parse(text) as Partial<NoticeFile>;
  if (parsed.version !== 1 || !Array.isArray(parsed.notices))
    throw new GitHubError('공지 파일 형식이 올바르지 않아요.', 0);
  return { notices: parsed.notices, faqs: Array.isArray(parsed.faqs) ? parsed.faqs : null };
}

const contentsPath = (c: RepoConfig) => `/repos/${c.owner}/${c.repo}/contents/${c.path}`;

export async function loadContent(
  token: string,
  c: RepoConfig,
  ref = c.branch,
): Promise<LoadedFile> {
  try {
    const data = await call<{ content: string; sha: string }>(
      token,
      `${contentsPath(c)}?ref=${encodeURIComponent(ref)}`,
    );
    return { content: readFile(fromBase64(data.content)), sha: data.sha };
  } catch (e) {
    // 파일이 아직 없으면 빈 목록으로 시작하고, 저장할 때 새로 만듭니다.
    if (e instanceof GitHubError && e.status === 404 && ref === c.branch)
      return { content: { notices: [], faqs: null }, sha: null };
    throw e;
  }
}

export async function saveContent(
  token: string,
  c: RepoConfig,
  content: Content,
  sha: string | null,
  message: string,
) {
  const file: NoticeFile = {
    version: 1,
    updatedAt: new Date().toISOString(),
    notices: content.notices,
    ...(content.faqs ? { faqs: content.faqs } : {}),
  };
  const res = await call<{ content: { sha: string } }>(token, contentsPath(c), {
    method: 'PUT',
    body: JSON.stringify({
      message,
      content: toBase64(`${JSON.stringify(file, null, 2)}\n`),
      branch: c.branch,
      ...(sha ? { sha } : {}),
    }),
  });
  return { sha: res.content.sha };
}

export type HistoryEntry = { sha: string; message: string; date: string; author: string };

/** 공지 파일이 바뀐 기록 (최근 20개) */
export async function loadHistory(token: string, c: RepoConfig): Promise<HistoryEntry[]> {
  const list = await call<
    {
      sha: string;
      commit: { message: string; author: { date: string; name: string } };
      author?: { login: string } | null;
    }[]
  >(
    token,
    `/repos/${c.owner}/${c.repo}/commits?path=${encodeURIComponent(c.path)}&sha=${encodeURIComponent(c.branch)}&per_page=20`,
  );
  return list.map((x) => ({
    sha: x.sha,
    message: x.commit.message.split('\n')[0],
    date: x.commit.author.date,
    author: x.author?.login ?? x.commit.author.name,
  }));
}
