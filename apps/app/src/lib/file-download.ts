import type { OpenSecondaryPanelTabRequest } from "@/components/secondary-panel/useThreadFileTabs";
import {
  buildProjectFileContentUrl,
  buildThreadHostFileContentUrl,
  buildThreadStorageRawContentUrl,
} from "./file-content-urls";
import { downloadBlob } from "./download-blob";
import { appToast } from "@/components/ui/app-toast";

interface DownloadFileForOpenRequestArgs {
  projectHostId: string | null;
  projectId: string | null;
  request: OpenSecondaryPanelTabRequest;
  resolvedEnvironmentId: string | null | undefined;
  threadId: string | null | undefined;
}

export function getFileOpenRequestPath(
  request: OpenSecondaryPanelTabRequest,
): string | null {
  return request.kind === "workspace-file-preview" ||
    request.kind === "host-file-preview" ||
    request.kind === "thread-storage-file-preview"
    ? request.tab.path
    : null;
}

function buildFileDownloadUrl({
  projectHostId,
  projectId,
  request,
  resolvedEnvironmentId,
  threadId,
}: DownloadFileForOpenRequestArgs): string | null {
  if (request.kind === "workspace-file-preview") {
    if (
      projectId === null ||
      request.tab.source.kind !== "working-tree" ||
      request.tab.statusLabel === "deleted"
    ) {
      return null;
    }
    const environmentId =
      request.environmentId ?? resolvedEnvironmentId ?? null;
    if (environmentId === null && projectHostId === null) return null;
    return buildProjectFileContentUrl(projectId, request.tab.path, {
      environmentId,
      hostId: projectHostId,
    });
  }

  if (request.kind === "host-file-preview") {
    if (request.hostId !== undefined || !threadId) return null;
    return buildThreadHostFileContentUrl(threadId, request.tab.path);
  }

  if (request.kind === "thread-storage-file-preview") {
    const storageThreadId = request.threadId ?? threadId;
    return storageThreadId
      ? buildThreadStorageRawContentUrl(storageThreadId, request.tab.path)
      : null;
  }

  return null;
}

export function downloadFileForOpenRequest(
  args: DownloadFileForOpenRequestArgs,
): boolean {
  const url = buildFileDownloadUrl(args);
  const path = getFileOpenRequestPath(args.request);
  if (url === null || path === null) {
    appToast.error("Download unavailable", {
      description: "This file location does not support downloads.",
    });
    return false;
  }

  const filename = path.split(/[\\/]/u).at(-1) ?? "download";
  void fetch(url)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }
      downloadBlob(await response.blob(), filename);
    })
    .catch((error: unknown) => {
      appToast.error("Failed to download file", {
        description:
          error instanceof Error ? error.message : "Unknown download error",
      });
    });
  return true;
}
