Name a thread yourself when you start it, instead of waiting for bb to generate a title.

## What you get

- A **Thread title** field above the composer on the New thread screen.
- The thread starts with your title in the sidebar, and bb skips generating one. Agents that keep their own session names, such as Codex, get it too.

## How it works

1. Type a title, then press Enter to move to the prompt.
2. Write the prompt and send it as usual.

The title is part of the new-thread draft. It comes back after a reload, follows you when you switch projects, and travels with **Save draft…** and **Send later…**, so a saved or scheduled thread shows your title from the start. If the send fails, the title is restored with the prompt. Leave the field empty and bb titles the thread as before.

A title alone doesn't start a thread; it waits for a prompt or an attachment. Rename a thread later from its row or `bb thread update --title`. From the CLI, `bb thread spawn --title` starts a thread with a title.

The plugin adds no agent tools or CLI commands. Plugins can read and set the same title with `useComposer().experimental_threadTitle` and `experimental_setThreadTitle`.
