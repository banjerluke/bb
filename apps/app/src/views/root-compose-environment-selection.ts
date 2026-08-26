import {
  findLocalPathProjectSourceForHost,
  type ProjectSource,
  type ThreadListEntry,
} from "@bb/domain";
import type {
  ProjectWorktree,
  ProjectWorktreeFailure,
  SystemEnvironmentProvider,
} from "@bb/server-contract";
import {
  PERSONAL_WORKSPACE_ENVIRONMENT_PROVIDER_ID,
  PROJECT_CHECKOUT_ENVIRONMENT_PROVIDER_ID,
} from "@bb/client-core";
import {
  encodeProviderValue,
  encodeReuseValue,
  encodeWorktreePathValue,
  parseEnvironmentValue,
  REUSE_VALUE_WITHOUT_ENVIRONMENT,
} from "@/components/pickers/environment-picker-value";
import type {
  ReuseDiscoveryFailure,
  ReuseThreadOption,
} from "@/components/pickers/ReuseEnvironmentPicker";
import { getThreadDisplayTitle } from "@/lib/thread-title";

interface ResolveRootComposeEffectiveEnvironmentValueArgs {
  environmentSelectionValue: string;
  environmentProviders?: readonly SystemEnvironmentProvider[];
  isProjectless: boolean;
  knownHostIds: ReadonlySet<string>;
  primaryHostId: string | null;
  projectSources: readonly ProjectSource[];
  reuseThreadOptions: readonly ReuseThreadOption[];
  reuseThreadOptionsLoading: boolean;
  hasReuseDiscoveryFailures: boolean;
}

interface ResolveProjectlessEnvironmentValueArgs {
  environmentProviders: readonly SystemEnvironmentProvider[] | undefined;
  environmentSelectionValue: string;
  parsedSelection: ReturnType<typeof parseEnvironmentValue>;
  primaryHostId: string | null;
  reuseThreadOptions: readonly ReuseThreadOption[];
  reuseThreadOptionsLoading: boolean;
}

interface ResolveHostEnvironmentProviderArgs {
  currentProvider: SystemEnvironmentProvider | null;
  providers: readonly SystemEnvironmentProvider[];
}

export function resolveHostEnvironmentProvider({
  currentProvider,
  providers,
}: ResolveHostEnvironmentProviderArgs): SystemEnvironmentProvider | null {
  const candidates = providers.filter(
    (provider) =>
      provider.machineProviderId === null &&
      provider.availability?.status !== "unavailable",
  );
  return (
    candidates.find((provider) => provider.id === currentProvider?.id) ??
    candidates[0] ??
    (currentProvider?.machineProviderId === null ? currentProvider : null)
  );
}

interface ReuseThreadOptionsModel {
  options: ReuseThreadOption[];
  failures: ReuseDiscoveryFailure[];
}

interface BuildReuseThreadOptionsArgs {
  threads: readonly ThreadListEntry[];
  worktrees: readonly ProjectWorktree[];
  failures: readonly ProjectWorktreeFailure[];
  hostNameById: ReadonlyMap<string, string> | null;
}

type ThreadPreview = ReuseThreadOption["threads"][number];

function threadPreviewsByEnvironmentId(
  threads: readonly ThreadListEntry[],
): Map<string, ThreadPreview[]> {
  const buckets = new Map<string, ThreadListEntry[]>();
  for (const thread of threads) {
    if (thread.environmentId === null) continue;
    const bucket = buckets.get(thread.environmentId);
    if (bucket) {
      bucket.push(thread);
    } else {
      buckets.set(thread.environmentId, [thread]);
    }
  }
  const previews = new Map<string, ThreadPreview[]>();
  for (const [environmentId, bucket] of buckets) {
    bucket.sort(
      (left, right) => right.latestAttentionAt - left.latestAttentionAt,
    );
    previews.set(
      environmentId,
      bucket.map((thread) => ({
        id: thread.id,
        title: getThreadDisplayTitle(thread),
      })),
    );
  }
  return previews;
}

function discoveredWorktreeOption(
  worktree: ProjectWorktree,
  hostName: string | null,
  threads: readonly ThreadPreview[],
): ReuseThreadOption {
  const { availability, checkout } = worktree;
  return {
    value:
      worktree.environmentId !== null
        ? encodeReuseValue(worktree.environmentId)
        : availability.kind === "selectable"
          ? encodeWorktreePathValue(worktree.hostId, availability.canonicalPath)
          : null,
    environmentId: worktree.environmentId,
    branchName: checkout.kind === "branch" ? checkout.branchName : null,
    name: worktree.environmentName,
    path: worktree.path,
    environmentProviderId: worktree.environmentProviderId,
    hostId: worktree.hostId,
    hostName,
    worktree: {
      detachedHeadSha: checkout.kind === "detached" ? checkout.headSha : null,
      lock: worktree.lock,
      unavailableReason:
        availability.kind === "selectable" ? null : availability.reason,
      userManaged: worktree.ownership === "user-managed",
    },
    threads,
  };
}

function reuseOptionSortLabel(option: ReuseThreadOption): string {
  return (
    option.name ??
    option.branchName ??
    option.worktree?.detachedHeadSha ??
    option.path ??
    option.environmentId ??
    ""
  );
}

export function buildReuseThreadOptions({
  threads,
  worktrees,
  failures,
  hostNameById,
}: BuildReuseThreadOptionsArgs): ReuseThreadOptionsModel {
  const hostName = (hostId: string | null): string | null =>
    hostNameById === null || hostId === null
      ? null
      : (hostNameById.get(hostId) ?? null);
  const previews = threadPreviewsByEnvironmentId(threads);
  const optionsByEnvironmentId = new Map<string, ReuseThreadOption>();
  for (const thread of threads) {
    const environmentId = thread.environmentId;
    if (environmentId === null || optionsByEnvironmentId.has(environmentId)) {
      continue;
    }
    optionsByEnvironmentId.set(environmentId, {
      value: encodeReuseValue(environmentId),
      environmentId,
      branchName: thread.environmentBranchName,
      name: thread.environmentName,
      path: thread.environmentPath,
      environmentProviderId: thread.environmentProviderId,
      hostId: thread.environmentHostId,
      hostName: hostName(thread.environmentHostId),
      worktree: null,
      threads: previews.get(environmentId) ?? [],
    });
  }
  const discovered: ReuseThreadOption[] = [];
  for (const worktree of worktrees) {
    const option = discoveredWorktreeOption(
      worktree,
      hostName(worktree.hostId),
      worktree.environmentId === null
        ? []
        : (previews.get(worktree.environmentId) ?? []),
    );
    if (worktree.environmentId === null) {
      discovered.push(option);
    } else {
      optionsByEnvironmentId.set(worktree.environmentId, option);
    }
  }
  const options = [...optionsByEnvironmentId.values(), ...discovered];
  options.sort((left, right) => {
    const environmentRank =
      Number(right.environmentId !== null) -
      Number(left.environmentId !== null);
    if (environmentRank !== 0) return environmentRank;
    const labelCompare = reuseOptionSortLabel(left).localeCompare(
      reuseOptionSortLabel(right),
    );
    if (labelCompare !== 0) return labelCompare;
    return (left.path ?? "").localeCompare(right.path ?? "");
  });
  return {
    options,
    failures: failures.map((failure) => ({
      hostId: failure.hostId,
      hostName: hostName(failure.hostId),
      message: failure.message,
    })),
  };
}

export function resolveProjectlessDefaultEnvironmentProvider(
  providers: readonly SystemEnvironmentProvider[],
): SystemEnvironmentProvider | null {
  return (
    providers.find(
      (provider) =>
        provider.id === PERSONAL_WORKSPACE_ENVIRONMENT_PROVIDER_ID &&
        provider.requires.projectless,
    ) ?? null
  );
}

function resolveProjectlessEnvironmentValue({
  environmentProviders,
  environmentSelectionValue,
  parsedSelection,
  primaryHostId,
  reuseThreadOptions,
  reuseThreadOptionsLoading,
}: ResolveProjectlessEnvironmentValueArgs): string {
  if (
    parsedSelection?.type === "reuse" &&
    parsedSelection.environmentId !== null &&
    (reuseThreadOptionsLoading ||
      reuseThreadOptions.some(
        (option) => option.environmentId === parsedSelection.environmentId,
      ))
  ) {
    return environmentSelectionValue;
  }
  if (environmentProviders === undefined) {
    return "";
  }
  if (
    parsedSelection?.type === "provider" &&
    environmentProviders.some((provider) => {
      if (provider.id !== parsedSelection.environmentProviderId) return false;
      return provider.requires.projectless && primaryHostId !== null;
    })
  ) {
    return environmentSelectionValue;
  }
  const defaultProvider = resolveProjectlessDefaultEnvironmentProvider(
    environmentProviders.filter(
      (provider) => provider.requires.projectless && primaryHostId !== null,
    ),
  );
  return defaultProvider === null
    ? ""
    : encodeProviderValue(defaultProvider.id);
}

export function resolveRootComposeEffectiveEnvironmentValue({
  environmentSelectionValue,
  environmentProviders,
  isProjectless,
  knownHostIds,
  primaryHostId,
  projectSources,
  reuseThreadOptions,
  reuseThreadOptionsLoading,
  hasReuseDiscoveryFailures,
}: ResolveRootComposeEffectiveEnvironmentValueArgs): string {
  const parsedSelection = parseEnvironmentValue(environmentSelectionValue);

  if (isProjectless) {
    return resolveProjectlessEnvironmentValue({
      environmentProviders,
      environmentSelectionValue,
      parsedSelection,
      primaryHostId,
      reuseThreadOptions,
      reuseThreadOptionsLoading,
    });
  }

  if (environmentProviders === undefined) {
    return "";
  }
  const providerRegistered = (environmentProviderId: string): boolean =>
    environmentProviders.some(
      (provider) => provider.id === environmentProviderId,
    );
  const selectedProvider =
    parsedSelection?.type === "provider"
      ? environmentProviders.find(
          (provider) => provider.id === parsedSelection.environmentProviderId,
        )
      : undefined;
  const fallbackValue =
    primaryHostId !== null &&
    knownHostIds.has(primaryHostId) &&
    findLocalPathProjectSourceForHost(projectSources, primaryHostId) !==
      undefined &&
    providerRegistered(PROJECT_CHECKOUT_ENVIRONMENT_PROVIDER_ID)
      ? encodeProviderValue(PROJECT_CHECKOUT_ENVIRONMENT_PROVIDER_ID)
      : "";
  const reuseListed = (): boolean =>
    reuseThreadOptions.some(
      (option) =>
        option.value !== null && option.value === environmentSelectionValue,
    );

  if (parsedSelection?.type === "reuse") {
    if (parsedSelection.environmentId === null) {
      return reuseThreadOptionsLoading ||
        reuseThreadOptions.length > 0 ||
        hasReuseDiscoveryFailures
        ? environmentSelectionValue
        : fallbackValue;
    }
    if (reuseThreadOptionsLoading || reuseListed()) {
      return environmentSelectionValue;
    }
    return REUSE_VALUE_WITHOUT_ENVIRONMENT;
  }

  if (parsedSelection?.type === "worktree-path") {
    if (
      !providerRegistered(PROJECT_CHECKOUT_ENVIRONMENT_PROVIDER_ID) ||
      !knownHostIds.has(parsedSelection.hostId)
    ) {
      return fallbackValue;
    }
    return reuseThreadOptionsLoading || reuseListed()
      ? environmentSelectionValue
      : REUSE_VALUE_WITHOUT_ENVIRONMENT;
  }

  if (
    selectedProvider !== undefined &&
    (selectedProvider.machineProviderId !== null || primaryHostId !== null)
  ) {
    return environmentSelectionValue;
  }

  return fallbackValue;
}
