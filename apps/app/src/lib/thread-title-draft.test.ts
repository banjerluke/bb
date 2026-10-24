// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  submittedThreadTitle,
  threadTitleDraftController,
} from "./thread-title-draft";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("thread title draft", () => {
  it("persists beside its prompt draft and removes the key when emptied", () => {
    const title = threadTitleDraftController("bb.promptbox.contents-draft-3");
    title.set("Release notes");
    expect(
      window.localStorage.getItem("bb.promptbox.contents-draft-3:thread-title"),
    ).toBe("Release notes");
    title.set("");
    expect(
      window.localStorage.getItem("bb.promptbox.contents-draft-3:thread-title"),
    ).toBeNull();
  });

  it("picks up a title typed in another window", () => {
    const title = threadTitleDraftController("draft-cross-tab");
    const listener = vi.fn();
    const unsubscribe = title.subscribe(listener);
    window.localStorage.setItem(
      "draft-cross-tab:thread-title",
      "From the other tab",
    );
    window.dispatchEvent(
      new StorageEvent("storage", { key: "draft-cross-tab:thread-title" }),
    );
    expect(listener).toHaveBeenCalledTimes(1);
    expect(title.get()).toBe("From the other tab");
    unsubscribe();
  });

  it("keeps a title in memory when storage refuses the write", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    const title = threadTitleDraftController("draft-quota");
    title.set("Still here");
    expect(title.get()).toBe("Still here");
  });

  it("collapses whitespace and treats a blank title as none", () => {
    expect(submittedThreadTitle("  Ship\n\tit  ")).toBe("Ship it");
    expect(submittedThreadTitle(" \n ")).toBeUndefined();
  });
});
