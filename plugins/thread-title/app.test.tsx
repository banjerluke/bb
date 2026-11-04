// @vitest-environment jsdom

import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";

const app = await loadPluginApp(() => import("./app"));
const customization = app.composerCustomizations[0]!;
const field = customization.banners![0]!;

afterEach(() => {
  cleanup();
});

describe("thread title field", () => {
  it("is offered only where a composer starts a thread", () => {
    expect(customization.scopes).toEqual(["new-thread"]);
    const slot = renderSlot(
      field,
      {},
      { composer: { scope: { kind: "thread", threadId: "thr_1" } } },
    );
    expect(slot.queryByRole("textbox", { name: "Thread title" })).toBeNull();
  });

  it("edits the draft's thread title as typed", () => {
    const slot = renderSlot(
      field,
      {},
      { composer: { scope: { kind: "new-thread", projectId: "proj_1" } } },
    );
    const input = slot.getByRole("textbox", { name: "Thread title" });
    fireEvent.change(input, { target: { value: "  Release notes " } });
    expect(slot.composer.threadTitle).toBe("  Release notes ");
    expect(input).toHaveProperty("value", "  Release notes ");
  });

  it("shows the title the draft already holds", () => {
    const slot = renderSlot(
      field,
      {},
      {
        composer: {
          scope: { kind: "new-thread", projectId: "proj_1" },
          threadTitle: "Restored title",
        },
      },
    );
    expect(slot.getByRole("textbox", { name: "Thread title" })).toHaveProperty(
      "value",
      "Restored title",
    );
  });

  it("moves to the prompt on Enter instead of sending", () => {
    const slot = renderSlot(
      field,
      {},
      {
        composer: {
          scope: { kind: "new-thread", projectId: "proj_1" },
          text: "Write the notes",
        },
      },
    );
    fireEvent.keyDown(slot.getByRole("textbox", { name: "Thread title" }), {
      key: "Enter",
    });
    expect(slot.composer.focusCount).toBe(1);
    expect(slot.composer.submits).toEqual([]);
  });
});
