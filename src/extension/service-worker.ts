import { NATIVE_HOST } from '../constants.ts';
import type { DavRequest, DavResponse } from '../dav.ts';
import { type Outcome, openCurrentFile, type PageInfo } from '../open.ts';
import type { OpenReply, OpenRequest } from '../protocol.ts';

const RESULT_KEY = 'lastResult';

// Runs inside the page (self-contained: it is serialised into the tab).
function readPageInfo(): PageInfo & { token: string | null } {
  const head = document.head?.dataset;
  const oc = (window as unknown as { OC?: { currentUser?: string; requestToken?: string } }).OC;
  const user = head?.user || oc?.currentUser || null;
  const token = head?.requesttoken || oc?.requestToken || null;
  return { user, token };
}

// Runs inside the page, where the session cookie applies to the same-origin request.
async function davInPage(request: DavRequest, token: string | null): Promise<DavResponse> {
  const headers: Record<string, string> = { ...request.headers };
  if (token) headers.requesttoken = token;
  const response = await fetch(request.url, {
    method: request.method,
    headers,
    body: request.body,
    credentials: 'same-origin',
  });
  return { status: response.status, text: await response.text() };
}

async function pageContext(tabId: number) {
  const [probe] = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: readPageInfo,
  });
  return probe?.result ?? { user: null, token: null };
}

function sendToOpener(request: OpenRequest): Promise<OpenReply> {
  return chrome.runtime.sendNativeMessage(NATIVE_HOST, request).then(
    (reply) => reply as OpenReply,
    (error: unknown) => ({
      ok: false as const,
      code: 'launch-failed' as const,
      message: `The local opener is not reachable (${error instanceof Error ? error.message : String(error)}). Run its install command (see the README).`,
    }),
  );
}

async function openTab(tab: chrome.tabs.Tab): Promise<Outcome> {
  if (tab.id === undefined || !tab.url) return { ok: false, message: 'No page to read.' };
  const tabId = tab.id;
  let token: string | null = null;
  return openCurrentFile(tab.url, {
    pageInfo: async () => {
      const info = await pageContext(tabId);
      token = info.token;
      return { user: info.user };
    },
    dav: async (request) => {
      const [run] = await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: davInPage,
        args: [request, token],
      });
      if (!run?.result) throw new Error('The page did not answer the file lookup.');
      return run.result;
    },
    opener: sendToOpener,
  });
}

async function report(tabId: number | undefined, outcome: Outcome) {
  await chrome.storage.session.set({ [RESULT_KEY]: outcome });
  if (outcome.ok) {
    await chrome.action.setBadgeText({ text: '' });
    return;
  }
  await chrome.action.setBadgeText({ text: '!', ...(tabId === undefined ? {} : { tabId }) });
  await chrome.action.setBadgeBackgroundColor({ color: '#c0392b' });
  await chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
    title: 'Nextcloud Open Locally',
    message: outcome.message,
  });
}

chrome.action.onClicked.addListener(async (tab) => {
  let outcome: Outcome;
  try {
    outcome = await openTab(tab);
  } catch (error) {
    outcome = { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
  await report(tab.id, outcome);
});
