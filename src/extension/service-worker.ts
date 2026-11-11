import { NATIVE_HOST } from '../constants.ts';
import type { DavRequest, DavResponse } from '../dav.ts';
import { type Outcome, openCurrentFile, type PageInfo } from '../open.ts';
import type { OpenProgress, OpenReply, OpenRequest } from '../protocol.ts';
import { mergeSettings, SETTINGS_KEY } from '../settings.ts';

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

const NOT_REACHABLE = (detail: string): OpenReply => ({
  ok: false,
  code: 'launch-failed',
  message: `The local opener is not reachable (${detail}). Run its install command (see the README).`,
});

// One port per request: the opener may report that it is waiting before its final answer.
function sendToOpener(
  request: OpenRequest,
  progress: (message: string) => void,
): Promise<OpenReply> {
  return new Promise((resolve) => {
    let port: chrome.runtime.Port;
    try {
      port = chrome.runtime.connectNative(NATIVE_HOST);
    } catch (error) {
      resolve(NOT_REACHABLE(error instanceof Error ? error.message : String(error)));
      return;
    }
    let answered = false;
    port.onMessage.addListener((message: OpenReply | OpenProgress) => {
      if ('status' in message) {
        progress(message.message);
        return;
      }
      answered = true;
      resolve(message);
      port.disconnect();
    });
    port.onDisconnect.addListener(() => {
      if (answered) return;
      resolve(NOT_REACHABLE(chrome.runtime.lastError?.message ?? 'it exited without an answer'));
    });
    port.postMessage(request);
  });
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
    navigate: async (url) => {
      await chrome.tabs.update(tabId, { url });
    },
    leaveEditor: mergeSettings((await chrome.storage.local.get(SETTINGS_KEY))[SETTINGS_KEY])
      .leaveEditor,
    waiting: (message) => {
      void notify(WAITING_ID, message);
    },
  });
}

const WAITING_ID = 'waiting';

function notify(id: string | undefined, message: string) {
  const options = {
    type: 'basic' as const,
    iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
    title: 'Nextcloud Open Locally',
    message,
  };
  return id ? chrome.notifications.create(id, options) : chrome.notifications.create(options);
}

async function report(tabId: number | undefined, outcome: Outcome) {
  await chrome.storage.session.set({ [RESULT_KEY]: outcome });
  await chrome.notifications.clear(WAITING_ID);
  if (outcome.ok) {
    await chrome.action.setBadgeText({ text: '' });
    if (outcome.notice) await notify(undefined, outcome.notice);
    return;
  }
  await chrome.action.setBadgeText({ text: '!', ...(tabId === undefined ? {} : { tabId }) });
  await chrome.action.setBadgeBackgroundColor({ color: '#c0392b' });
  await notify(undefined, outcome.message);
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
