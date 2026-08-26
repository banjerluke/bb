import { useMemo } from "react";
import { Button } from "@bb/shared-ui/button";
import { cn } from "@bb/shared-ui/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@bb/shared-ui/dropdown-menu";
import { Icon, type IconName } from "@bb/shared-ui/icon";
import { LIST_HOVER_TRANSITION } from "@bb/shared-ui/motion";
import {
  COARSE_POINTER_COMPACT_ICON_SIZE_CLASS,
  COARSE_POINTER_COMPACT_ICON_SIZE_SHRINK_CLASS,
  COARSE_POINTER_ICON_SIZE_CLASS,
} from "@bb/shared-ui/coarse-pointer-sizing";
import { GIT_WORKTREE_ENVIRONMENT_PROVIDER_ID } from "@bb/client-core";
import {
  findEnvironmentDisplayProvider,
  getEnvironmentLabelIconName,
  REUSE_ENVIRONMENT_ICON_NAME,
  UNNAMED_ENVIRONMENT_LABEL,
} from "@/lib/environment-workspace-display";
import { useSystemEnvironmentProviders } from "@/hooks/queries/environment-provider-queries";
import { resolveEnvironmentDisplayName } from "@bb/core-ui";
import type { SystemEnvironmentProvider } from "@bb/server-contract";
import {
  OPTION_BASE_CLASS_NAME,
  OPTION_INTERACTIVE_CLASS_NAME,
  OPTION_MENU_CONTENT_CLASS_NAME,
  OPTION_MUTED_CLASS_NAME,
  OPTION_TRIGGER_CONTENT_CLASS_NAME,
} from "@bb/shared-ui/option-display";

const REUSE_THREAD_PREVIEW_LIMIT = 2;
const UNAVAILABLE_REMEDIATION =
  "Inspect with `git worktree list`; clean up with `git worktree prune`.";

export interface ReuseWorktreeDetails {
  detachedHeadSha: string | null;
  lock: { reason: string | null } | null;
  unavailableReason: "missing" | "prunable" | null;
  userManaged: boolean;
}

export interface ReuseThreadOption {
  value: string | null;
  environmentId: string | null;
  branchName: string | null;
  name: string | null;
  path: string | null;
  environmentProviderId: string | null;
  hostId: string | null;
  hostName: string | null;
  worktree: ReuseWorktreeDetails | null;
  threads: ReadonlyArray<{ id: string; title: string }>;
}

export interface ReuseDiscoveryFailure {
  hostId: string;
  hostName: string | null;
  message: string;
}

export function reuseThreadOptionDisplay(
  option: ReuseThreadOption,
  providers: readonly SystemEnvironmentProvider[] | undefined,
): { label: string; icon: IconName; secondaryText: string | null } {
  const providerLookup = findEnvironmentDisplayProvider(
    providers,
    option.environmentProviderId ??
      (option.worktree === null ? null : GIT_WORKTREE_ENVIRONMENT_PROVIDER_ID),
  );
  const detachedLabel =
    option.worktree?.detachedHeadSha == null
      ? null
      : `Detached at ${option.worktree.detachedHeadSha.slice(0, 7)}`;
  return {
    label:
      option.name ??
      option.branchName ??
      detachedLabel ??
      resolveEnvironmentDisplayName(
        {
          name: option.name,
          branchName: option.branchName,
          path: option.path,
          environmentProviderId: option.environmentProviderId,
        },
        providerLookup,
      ) ??
      UNNAMED_ENVIRONMENT_LABEL,
    icon: getEnvironmentLabelIconName(providerLookup),
    secondaryText: option.hostName,
  };
}

function reuseThreadOptionKey(option: ReuseThreadOption): string {
  return (
    option.value ??
    JSON.stringify([option.environmentId, option.hostId, option.path])
  );
}

interface ReuseEnvironmentPickerProps {
  options: readonly ReuseThreadOption[];
  failures: readonly ReuseDiscoveryFailure[];
  value: string | null;
  onChange: (value: string) => void;
  onRetry?: () => void;
  loading?: boolean;
  muted?: boolean;
  disabled?: boolean;
  modal?: boolean;
}

export function ReuseEnvironmentPicker({
  options,
  failures,
  value,
  onChange,
  onRetry,
  loading = false,
  muted,
  disabled = false,
  modal,
}: ReuseEnvironmentPickerProps) {
  const { providers } = useSystemEnvironmentProviders();
  const activeOption = useMemo(
    () =>
      value === null
        ? null
        : (options.find((option) => option.value === value) ?? null),
    [options, value],
  );
  const trigger =
    activeOption === null
      ? { label: "Pick an environment", icon: REUSE_ENVIRONMENT_ICON_NAME }
      : reuseThreadOptionDisplay(activeOption, providers);
  const isEmpty = options.length === 0 && failures.length === 0;
  return (
    <DropdownMenu modal={modal}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Environment"
          disabled={disabled}
          data-promptbox-icon-only-control=""
          className={cn(
            OPTION_BASE_CLASS_NAME,
            !disabled && OPTION_INTERACTIVE_CLASS_NAME,
            !disabled && LIST_HOVER_TRANSITION,
            muted && OPTION_MUTED_CLASS_NAME,
            disabled && "cursor-default disabled:opacity-100",
          )}
        >
          <span className={OPTION_TRIGGER_CONTENT_CLASS_NAME}>
            <Icon
              name={trigger.icon}
              className={COARSE_POINTER_COMPACT_ICON_SIZE_SHRINK_CLASS}
            />
            <span className="min-w-0 truncate" data-promptbox-full-label="">
              {trigger.label}
            </span>
          </span>
          {disabled ? null : (
            <Icon
              name="ChevronDown"
              className={cn(
                "shrink-0 text-muted-foreground",
                COARSE_POINTER_COMPACT_ICON_SIZE_CLASS,
              )}
            />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className={cn(OPTION_MENU_CONTENT_CLASS_NAME, "max-w-96")}
        mobileTitle="Environment"
      >
        <DropdownMenuLabel>Reuse an existing environment</DropdownMenuLabel>
        {isEmpty ? (
          <div className="px-2 py-2 text-xs text-muted-foreground">
            {loading ? "Discovering worktrees…" : "Nothing to reuse yet."}
          </div>
        ) : (
          <>
            {options.map((option) => (
              <ReuseEnvironmentMenuItem
                key={reuseThreadOptionKey(option)}
                option={option}
                providers={providers}
                isSelected={option.value !== null && option.value === value}
                onSelect={onChange}
              />
            ))}
            {failures.map((failure) => (
              <ReuseDiscoveryFailureRow
                key={failure.hostId}
                failure={failure}
                onRetry={onRetry}
              />
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface ReuseEnvironmentMenuItemProps {
  option: ReuseThreadOption;
  providers: readonly SystemEnvironmentProvider[] | undefined;
  isSelected: boolean;
  onSelect: (value: string) => void;
}

function ReuseEnvironmentMenuItem({
  option,
  providers,
  isSelected,
  onSelect,
}: ReuseEnvironmentMenuItemProps) {
  const previewThreads = option.threads.slice(0, REUSE_THREAD_PREVIEW_LIMIT);
  const additionalCount = option.threads.length - previewThreads.length;
  const { label, icon, secondaryText } = reuseThreadOptionDisplay(
    option,
    providers,
  );
  const branchDetail = option.name ? option.branchName : null;
  const worktree = option.worktree;
  const unavailableReason = worktree?.unavailableReason ?? null;
  const optionValue = option.value;
  return (
    <DropdownMenuItem
      disabled={optionValue === null}
      onSelect={() => {
        if (optionValue !== null) {
          onSelect(optionValue);
        }
      }}
      className={cn(
        "flex flex-col items-stretch gap-1 py-2",
        LIST_HOVER_TRANSITION,
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Icon
          name={icon}
          className={cn(
            "shrink-0 text-muted-foreground",
            COARSE_POINTER_COMPACT_ICON_SIZE_SHRINK_CLASS,
          )}
        />
        <span className="flex min-w-0 flex-1 items-baseline gap-1 truncate text-xs">
          <span className="min-w-0 truncate font-medium">{label}</span>
          {branchDetail ? (
            <span className="min-w-0 truncate text-muted-foreground">
              {branchDetail}
            </span>
          ) : null}
        </span>
        {worktree?.userManaged ? (
          <span className="shrink-0 rounded-sm border border-border bg-muted/40 px-1.5 py-0.5 text-2xs leading-none text-subtle-foreground">
            User-managed
          </span>
        ) : null}
        <Icon
          name="Check"
          className={cn(
            COARSE_POINTER_ICON_SIZE_CLASS,
            isSelected ? "opacity-100" : "opacity-0",
          )}
        />
      </span>
      {secondaryText ? (
        <span className="truncate pl-6 text-xs text-muted-foreground">
          {secondaryText}
        </span>
      ) : null}
      {worktree !== null && option.path !== null ? (
        <span className="truncate pl-6 text-xs text-muted-foreground">
          {option.path}
        </span>
      ) : null}
      {worktree?.lock && unavailableReason === null ? (
        <span className="truncate pl-6 text-xs text-warning-foreground">
          {worktree.lock.reason === null
            ? "Locked"
            : `Locked: ${worktree.lock.reason}`}
        </span>
      ) : null}
      {unavailableReason !== null ? (
        <span className="pl-6 text-xs text-muted-foreground">
          {unavailableReason === "missing"
            ? "Directory is missing. "
            : "Registration is prunable. "}
          {UNAVAILABLE_REMEDIATION}
        </span>
      ) : null}
      {previewThreads.length > 0 ? (
        <span className="flex flex-col gap-0.5 pl-6 text-xs text-muted-foreground">
          {previewThreads.map((thread) => (
            <span key={thread.id} className="truncate">
              {thread.title}
            </span>
          ))}
          {additionalCount > 0 ? (
            <span className="text-muted-foreground">
              +{additionalCount} more
            </span>
          ) : null}
        </span>
      ) : null}
    </DropdownMenuItem>
  );
}

interface ReuseDiscoveryFailureRowProps {
  failure: ReuseDiscoveryFailure;
  onRetry?: () => void;
}

function ReuseDiscoveryFailureRow({
  failure,
  onRetry,
}: ReuseDiscoveryFailureRowProps) {
  return (
    <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
      <Icon
        name="AlertTriangle"
        className={cn(
          "shrink-0",
          COARSE_POINTER_COMPACT_ICON_SIZE_SHRINK_CLASS,
        )}
      />
      <span className="min-w-0 flex-1 truncate">
        {failure.hostName !== null
          ? `${failure.hostName}: ${failure.message}`
          : failure.message}
      </span>
      {onRetry ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 shrink-0 px-2 text-xs"
          onClick={(event) => {
            event.preventDefault();
            onRetry();
          }}
        >
          Retry
        </Button>
      ) : null}
    </div>
  );
}
