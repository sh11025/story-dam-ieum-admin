// 깃허브 API를 가짜로 흉내 내서 관리자 화면 흐름을 확인하는 테스트입니다.
import { expect, test, type Page } from '@playwright/test';

const TOKEN = 'github_pat_test_only';
type Stored = { content: string; sha: string } | null;

async function fakeGitHub(
  page: Page,
  initial: object | null,
  opts: { push?: boolean; expiry?: string } = {},
) {
  const state: {
    file: Stored;
    puts: { message: string; json: unknown; sha?: string }[];
    conflictNext: boolean;
    versions: { content: string; sha: string; date: string }[];
  } = {
    file: initial
      ? { content: Buffer.from(JSON.stringify(initial)).toString('base64'), sha: 'sha-0' }
      : null,
    puts: [],
    conflictNext: false,
    versions: [],
  };
  if (state.file) state.versions.push({ ...state.file, date: '2026-10-01T00:00:00Z' });
  await page.route('https://api.github.com/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.headers()['authorization'] !== `Bearer ${TOKEN}`)
      return route.fulfill({ status: 401, json: { message: 'Bad credentials' } });
    if (url.pathname === '/user')
      return route.fulfill({
        json: { login: 'dami-admin' },
        headers: opts.expiry
          ? {
              'github-authentication-token-expiration': opts.expiry,
              'access-control-expose-headers': 'github-authentication-token-expiration',
            }
          : {},
      });
    if (url.pathname === '/repos/dami/story-admin/commits') {
      const versions = [...state.versions].reverse();
      return route.fulfill({
        json: versions.map((v, i) => ({
          sha: v.sha,
          commit: {
            message: `수정 ${versions.length - i}`,
            author: { date: v.date, name: 'dami' },
          },
          author: { login: 'dami-admin' },
        })),
      });
    }
    if (url.pathname === '/repos/dami/story-admin')
      return route.fulfill({
        json: { permissions: { push: opts.push ?? true }, default_branch: 'main', private: false },
      });
    if (url.pathname === '/repos/dami/story-admin/contents/data/notices.json') {
      const ref = url.searchParams.get('ref');
      const old = state.versions.find((v) => v.sha === ref);
      if (req.method() === 'GET' && old) return route.fulfill({ json: old });
      if (req.method() === 'GET')
        return state.file
          ? route.fulfill({ json: state.file })
          : route.fulfill({ status: 404, json: {} });
      if (req.method() === 'PUT') {
        const body = req.postDataJSON();
        if (state.conflictNext || (state.file && body.sha !== state.file.sha)) {
          state.conflictNext = false;
          return route.fulfill({ status: 409, json: { message: 'conflict' } });
        }
        const sha = `sha-${state.puts.length + 1}`;
        state.file = { content: body.content, sha };
        state.versions.push({
          ...state.file,
          date: new Date(Date.now() + state.puts.length * 1000).toISOString(),
        });
        state.puts.push({
          message: body.message,
          json: JSON.parse(Buffer.from(body.content, 'base64').toString('utf8')),
          sha: body.sha,
        });
        return route.fulfill({ json: { content: { sha } } });
      }
    }
    return route.fulfill({ status: 404, json: {} });
  });
  return state;
}

async function login(page: Page, token = TOKEN) {
  await page.goto('/');
  await page.getByLabel('깃허브 사용자 이름').fill('dami');
  await page.getByLabel('저장소 이름').fill('story-admin');
  await page.getByLabel('깃허브 출입 키').fill(token);
  await page.getByRole('button', { name: '로그인' }).click();
}

test('admin logs in with a GitHub key, adds, edits and deletes notices, and saves Korean JSON', async ({
  page,
}) => {
  const gh = await fakeGitHub(page, null);
  await login(page);
  await expect(page.getByRole('heading', { name: '공지 관리' })).toBeVisible();
  await expect(page.getByText('아직 공지 파일이 없어요')).toBeVisible();

  await page.getByLabel('제목').fill('서비스 점검 안내');
  await page.getByLabel('내용').fill('10월 20일 새벽 2시부터 4시까지 점검합니다.');
  await page.getByLabel('게시일').fill('2026-10-15');
  await page.getByLabel(/중요 공지/).check();
  await page.getByRole('button', { name: '목록에 추가' }).click();
  await expect(page.getByText('저장하지 않은 변경 있음')).toBeVisible();
  await page.getByRole('button', { name: '깃허브에 저장' }).click();
  await expect(page.getByText('깃허브에 저장했어요')).toBeVisible();
  expect(gh.puts).toHaveLength(1);
  expect(gh.puts[0].sha).toBeUndefined();
  expect(gh.puts[0].json).toMatchObject({
    version: 1,
    notices: [
      {
        title: '서비스 점검 안내',
        body: '10월 20일 새벽 2시부터 4시까지 점검합니다.',
        urgent: true,
        publishedAt: '2026-10-15T00:00:00.000Z',
      },
    ],
  });

  await page.getByRole('button', { name: /서비스 점검 안내/ }).click();
  await page.getByLabel('제목').fill('서비스 점검 안내 (시간 변경)');
  await page.getByRole('button', { name: '수정 내용 반영' }).click();
  await page.getByRole('button', { name: '깃허브에 저장' }).click();
  await expect(page.getByText('깃허브에 저장했어요')).toBeVisible();
  expect(gh.puts[1].sha).toBe('sha-1');
  expect((gh.puts[1].json as { notices: { title: string }[] }).notices[0].title).toBe(
    '서비스 점검 안내 (시간 변경)',
  );

  await page.getByRole('button', { name: '삭제' }).click();
  await page.getByRole('button', { name: /정말 지울까요/ }).click();
  await page.getByRole('button', { name: '깃허브에 저장' }).click();
  await expect(page.getByText('깃허브에 저장했어요')).toBeVisible();
  expect((gh.puts[2].json as { notices: unknown[] }).notices).toHaveLength(0);
  await page.getByRole('button', { name: '연결 상태' }).click();
  await expect(page.locator('code.url')).toHaveText(
    'https://raw.githubusercontent.com/dami/story-admin/main/data/notices.json',
  );
});

test('wrong key, missing write permission and save conflicts show plain messages', async ({
  page,
}) => {
  await fakeGitHub(
    page,
    {
      version: 1,
      updatedAt: '',
      notices: [
        {
          id: 'a',
          title: '기존 공지',
          body: '',
          urgent: false,
          publishedAt: '2026-10-01T00:00:00Z',
        },
      ],
    },
    { push: false },
  );
  await login(page, 'wrong-key');
  await expect(page.getByRole('alert')).toContainText('출입 키가 올바르지 않거나');
  await page.getByLabel('깃허브 출입 키').fill(TOKEN);
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page.getByRole('alert')).toContainText('권한이 없어요');
  expect(
    await page.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage)),
  ).not.toContain(TOKEN);

  await page.unrouteAll();
  const gh = await fakeGitHub(page, {
    version: 1,
    updatedAt: '',
    notices: [
      { id: 'a', title: '기존 공지', body: '', urgent: false, publishedAt: '2026-10-01T00:00:00Z' },
    ],
  });
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page.getByRole('button', { name: /기존 공지/ })).toBeVisible();
  gh.conflictNext = true;
  await page.getByLabel('제목').fill('새 공지');
  await page.getByRole('button', { name: '목록에 추가' }).click();
  await page.getByRole('button', { name: '깃허브에 저장' }).click();
  await expect(page.getByRole('alert')).toContainText('다른 곳에서 공지가 먼저 수정되었어요');
});

test('notice period, FAQ editing, history restore and key expiry warning', async ({ page }) => {
  const soon =
    new Date(Date.now() + 3 * 86400000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const gh = await fakeGitHub(
    page,
    {
      version: 1,
      updatedAt: '',
      notices: [
        { id: 'a', title: '첫 공지', body: '', urgent: false, publishedAt: '2026-10-01T00:00:00Z' },
      ],
    },
    { expiry: soon },
  );
  await login(page);
  await expect(page.getByRole('alert')).toContainText('일 뒤 만료돼요');

  // 게시 기간
  await page.getByLabel('제목').fill('점검 안내');
  await page.getByLabel('내용').fill('**새벽 점검** 안내: https://example.com/notice');
  await page.getByLabel('보이기 시작하는 날 (선택)').fill('2026-10-20');
  await page.getByLabel('보이는 마지막 날 (선택)').fill('2026-10-19');
  await expect(page.getByText('마지막 날이 시작하는 날보다 앞이에요.')).toBeVisible();
  await page.getByLabel('보이는 마지막 날 (선택)').fill('2026-10-21');
  await expect(page.locator('.preview strong')).toHaveText('새벽 점검');
  await expect(page.locator('.preview a')).toHaveAttribute('href', 'https://example.com/notice');
  await page.getByRole('button', { name: '목록에 추가' }).click();

  // 자주 묻는 질문
  await page.getByRole('button', { name: '자주 묻는 질문' }).click();
  await page.getByRole('button', { name: '기본 질문으로 시작해서 고치기' }).click();
  await page.getByRole('button', { name: '+ 질문 추가' }).click();
  await page.getByLabel('질문 3', { exact: true }).fill('비용이 드나요?');
  await page.getByLabel('답변 3', { exact: true }).fill('무료예요.');
  await page.getByRole('button', { name: '깃허브에 저장' }).click();
  await expect(page.getByText('깃허브에 저장했어요')).toBeVisible();
  const saved = gh.puts[0].json as {
    notices: { title: string; startAt?: string; endAt?: string }[];
    faqs: { question: string }[];
  };
  const added = saved.notices.find((n) => n.title === '점검 안내')!;
  expect(added.startAt).toBe('2026-10-19T15:00:00.000Z');
  expect(added.endAt).toBe('2026-10-21T14:59:59.000Z');
  expect(saved.faqs.map((f) => f.question)).toEqual([
    '작업은 어디에 저장되나요?',
    '공고 주소로 가져오기가 안 돼요.',
    '비용이 드나요?',
  ]);

  // 수정 기록에서 처음 상태로 되돌리기
  await page.getByRole('button', { name: '수정 기록' }).click();
  await page.getByRole('button', { name: /수정 1/ }).click();
  await expect(page.getByRole('heading', { name: /의 공지/ })).toBeVisible();
  await page.getByRole('button', { name: '이 상태로 되돌리기' }).click();
  await expect(page.getByText(/상태로 되돌렸어요/)).toBeVisible();
  await expect(page.getByRole('button', { name: /점검 안내/ })).toHaveCount(0);
  await page.getByRole('button', { name: '깃허브에 저장' }).click();
  await expect(page.getByText('깃허브에 저장했어요')).toBeVisible();
  expect((gh.puts[1].json as { notices: unknown[]; faqs?: unknown }).notices).toHaveLength(1);
  expect((gh.puts[1].json as { faqs?: unknown }).faqs).toBeUndefined();
});

test('connection status checks the user site', async ({ page }) => {
  await fakeGitHub(page, { version: 1, updatedAt: '', notices: [] });
  await page.route('https://story.example.com/api/health', (route) =>
    route.fulfill({
      json: { ok: true, noticesConfigured: true, ai: { Gemini: true } },
      headers: { 'access-control-allow-origin': '*' },
    }),
  );
  await page.route('https://story.example.com/api/notices', (route) =>
    route.fulfill({
      json: { items: [{ id: 'x' }] },
      headers: { 'access-control-allow-origin': '*' },
    }),
  );
  await login(page);
  await page.getByRole('button', { name: '연결 상태' }).click();
  await page.getByLabel('사용자 사이트 주소 (Render)').fill('https://story.example.com/');
  await page.getByRole('button', { name: '연결 확인' }).click();
  await expect(page.locator('.status-lines')).toContainText('서버가 켜져 있어요');
  await expect(page.locator('.status-lines')).toContainText('공지 1개');
  await expect(page.locator('.status-lines')).toContainText('Gemini');
  await expect(page.getByLabel('키 만료일')).toBeVisible();
});
