export interface ThreadTitleDraftController {
  get: () => string;
  set: (title: string) => void;
  subscribe: (listener: () => void) => () => void;
  clearIfCurrentMatches: (expectedTitle: string) => boolean;
  restoreIfEmpty: (title: string) => void;
}

const THREAD_TITLE_DRAFT_KEY_SUFFIX = ":thread-title";

const controllers = new Map<string, ThreadTitleDraftController>();
const subscribers = new Map<string, Set<() => void>>();
const unpersistedTitles = new Map<string, string>();
let storageObserverInitialized = false;

function readTitle(storageKey: string): string {
  const unpersisted = unpersistedTitles.get(storageKey);
  if (unpersisted !== undefined) return unpersisted;
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(storageKey) ?? "";
  } catch {
    return "";
  }
}

function emitTitleChange(storageKey: string): void {
  for (const listener of subscribers.get(storageKey) ?? []) listener();
}

function writeTitle(storageKey: string, title: string): void {
  if (typeof window === "undefined" || readTitle(storageKey) === title) return;
  try {
    if (title === "") window.localStorage.removeItem(storageKey);
    else window.localStorage.setItem(storageKey, title);
    unpersistedTitles.delete(storageKey);
  } catch (error) {
    unpersistedTitles.set(storageKey, title);
    console.warn(
      `[thread-title-draft] could not persist ${storageKey}; keeping it in memory only`,
      error,
    );
  }
  emitTitleChange(storageKey);
}

function ensureStorageObserver(): void {
  if (storageObserverInitialized || typeof window === "undefined") return;
  storageObserverInitialized = true;
  window.addEventListener("storage", (event) => {
    if (event.key === null || !subscribers.has(event.key)) return;
    unpersistedTitles.delete(event.key);
    emitTitleChange(event.key);
  });
}

function subscribeTitle(storageKey: string, listener: () => void): () => void {
  ensureStorageObserver();
  let listeners = subscribers.get(storageKey);
  if (listeners === undefined) {
    listeners = new Set();
    subscribers.set(storageKey, listeners);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) subscribers.delete(storageKey);
  };
}

export function threadTitleDraftController(
  promptDraftStorageKey: string,
): ThreadTitleDraftController {
  const existing = controllers.get(promptDraftStorageKey);
  if (existing !== undefined) return existing;
  const storageKey = `${promptDraftStorageKey}${THREAD_TITLE_DRAFT_KEY_SUFFIX}`;
  const controller: ThreadTitleDraftController = {
    get: () => readTitle(storageKey),
    set: (title) => writeTitle(storageKey, title),
    subscribe: (listener) => subscribeTitle(storageKey, listener),
    clearIfCurrentMatches: (expectedTitle) => {
      if (readTitle(storageKey) !== expectedTitle) return false;
      writeTitle(storageKey, "");
      return true;
    },
    restoreIfEmpty: (title) => {
      if (readTitle(storageKey) === "") writeTitle(storageKey, title);
    },
  };
  controllers.set(promptDraftStorageKey, controller);
  return controller;
}

export function submittedThreadTitle(title: string): string | undefined {
  const normalized = title.replace(/\s+/gu, " ").trim();
  return normalized === "" ? undefined : normalized;
}
