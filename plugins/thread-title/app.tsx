import { Input } from "@/components/ui/input";
import { definePluginApp, useComposer } from "@get-bb/plugin-sdk/app";

export const THREAD_TITLE_MAX_LENGTH = 200;

function ThreadTitleField() {
  const composer = useComposer();
  const title = composer.experimental_threadTitle;
  if (title === null) return null;
  return (
    <Input
      aria-label="Thread title"
      className="h-9 rounded-xl border-border bg-background px-4 text-sm shadow-lift placeholder:text-subtle-foreground"
      enterKeyHint="next"
      maxLength={THREAD_TITLE_MAX_LENGTH}
      onChange={(event) =>
        composer.experimental_setThreadTitle(event.target.value)
      }
      onKeyDown={(event) => {
        if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
        event.preventDefault();
        composer.focus();
      }}
      placeholder="Thread title (optional)"
      value={title}
    />
  );
}

export default definePluginApp((app) => {
  app.composer.customize({
    id: "thread-title",
    scopes: ["new-thread"],
    banners: [
      { id: "thread-title", chrome: "bare", component: ThreadTitleField },
    ],
  });
});
