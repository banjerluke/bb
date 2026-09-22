export const CLAUDE_SUBAGENT_INVOCATION_TOOL_NAMES = new Set(["Agent", "Task"]);

export const CLAUDE_SUBAGENT_TOOL_NAMES = [
  "Agent",
  "Task",
  "ListAgents",
] as const;

export const CLAUDE_WORKFLOW_TOOL_NAME = "Workflow";

export const CLAUDE_INTERACTIVE_TOOL_NAMES = [
  "AskUserQuestion",
  "ScheduleWakeup",
  "ReportFindings",
] as const;
