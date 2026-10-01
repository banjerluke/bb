// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExperimentalLiveFileTarget } from "@get-bb/plugin-sdk";
import {
  DOWNLOAD_FILE_OPENER_PREFERENCE,
  useFileOpenerPreference,
} from "@/lib/file-opener-preference";
import { usePanelFiles, type PanelFileScope } from "./usePanelFiles";
import type { OpenSecondaryPanelTabRequest } from "./useThreadFileTabs";

interface SurfaceCase {
  name: string;
  scope: PanelFileScope | null;
  accepts: Record<
    "ownWorkspace" | "ownHost" | "ownStorage" | "otherWorkspace",
    boolean
  >;
}

const OWN_WORKSPACE: ExperimentalLiveFileTarget = {
  kind: "workspace",
  environmentId: "env_1",
  path: "src/a.ts",
};
const OTHER_WORKSPACE: ExperimentalLiveFileTarget = {
  kind: "workspace",
  environmentId: "env_other",
  path: "src/a.ts",
};
const OWN_HOST: ExperimentalLiveFileTarget = {
  kind: "host",
  hostId: "host_1",
  path: "/tmp/log.txt",
};
const OWN_STORAGE: ExperimentalLiveFileTarget = {
  kind: "thread-storage",
  threadId: "thr_1",
  path: "notes.md",
};

const SURFACES: readonly SurfaceCase[] = [
  {
    name: "thread view",
    scope: { threadId: "thr_1", environmentId: "env_1", hostId: "host_1" },
    accepts: {
      ownWorkspace: true,
      ownHost: true,
      ownStorage: true,
      otherWorkspace: false,
    },
  },
  {
    name: "New thread screen without a thread",
    scope: { threadId: null, environmentId: "env_1", hostId: "host_1" },
    accepts: {
      ownWorkspace: true,
      ownHost: false,
      ownStorage: false,
      otherWorkspace: false,
    },
  },
  {
    name: "plugin page",
    scope: null,
    accepts: {
      ownWorkspace: true,
      ownHost: true,
      ownStorage: true,
      otherWorkspace: true,
    },
  },
];

function renderSurface(surface: SurfaceCase, available = true) {
  const openTab = vi.fn((_request: OpenSecondaryPanelTabRequest) => ({
    id: "tab",
  }));
  const reveal = vi.fn();
  const { result } = renderHook(() =>
    usePanelFiles({ available, openTab, reveal, scope: surface.scope }),
  );
  return { openTab, result, reveal };
}

afterEach(cleanup);

describe.each(SURFACES)("panel files on the $name", (surface) => {
  it.each([
    ["ownWorkspace", OWN_WORKSPACE],
    ["ownHost", OWN_HOST],
    ["ownStorage", OWN_STORAGE],
    ["otherWorkspace", OTHER_WORKSPACE],
  ] as const)("applies the surface rule to a %s target", (caseName, target) => {
    const { openTab, result, reveal } = renderSurface(surface);
    let accepted = false;
    act(() => {
      accepted = result.current.openFilePreview({ target, location: null });
    });

    expect(accepted).toBe(surface.accepts[caseName]);
    expect(openTab).toHaveBeenCalledTimes(accepted ? 1 : 0);
    expect(reveal).toHaveBeenCalledTimes(accepted ? 1 : 0);
  });

  it("opens host files in the same tab shape core uses", () => {
    if (!surface.accepts.ownHost) return;
    const { openTab, result } = renderSurface(surface);
    act(() => {
      result.current.openFilePreview({ target: OWN_HOST, location: null });
      result.current.openHostFile({ lineRange: null, path: OWN_HOST.path });
    });

    const [apiRequest, coreRequest] = openTab.mock.calls.map(
      ([request]) => request,
    );
    expect(apiRequest).toEqual(
      surface.scope === null
        ? { ...coreRequest, hostId: OWN_HOST.hostId }
        : coreRequest,
    );
  });

  it("declines malformed targets and unavailable surfaces", () => {
    const { result: available } = renderSurface(surface);
    const { result: unavailable, openTab } = renderSurface(surface, false);

    expect(
      available.current.openFilePreview({
        target: { ...OWN_WORKSPACE, path: "../escape" },
        location: null,
      }),
    ).toBe(false);
    expect(
      unavailable.current.openFilePreview({
        target: OWN_WORKSPACE,
        location: null,
      }),
    ).toBe(false);
    expect(openTab).not.toHaveBeenCalled();
  });
});

describe("panel file downloads", () => {
  it("reports a preference-driven download as handled without revealing the panel", () => {
    const openTab = vi.fn(() => null);
    const reveal = vi.fn();
    const { result } = renderHook(() => {
      const [, setPreference] = useFileOpenerPreference();
      const files = usePanelFiles({
        available: true,
        openTab,
        reveal,
        scope: null,
      });
      return { files, setPreference };
    });
    const pdf = { ...OWN_WORKSPACE, path: "reports/q3.pdf" };

    expect(
      result.current.files.openFilePreview({ target: pdf, location: null }),
    ).toBe(false);
    act(() => {
      result.current.setPreference({ pdf: DOWNLOAD_FILE_OPENER_PREFERENCE });
    });
    expect(
      result.current.files.openFilePreview({ target: pdf, location: null }),
    ).toBe(true);
    expect(openTab).toHaveBeenCalledTimes(2);
    expect(reveal).not.toHaveBeenCalled();
    act(() => {
      result.current.setPreference({});
    });
  });
});
