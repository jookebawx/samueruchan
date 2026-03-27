import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Bold,
  Code,
  FileCode2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  Underline,
} from "lucide-react";
import { type ComponentType, useRef } from "react";

type MarkdownComposerProps = {
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  className?: string;
  maxLength?: number;
  minHeightClassName?: string;
};

type ToolbarButtonProps = {
  ariaLabel: string;
  onClick: () => void;
  icon: ComponentType<{ className?: string }>;
};

function ToolbarButton({ ariaLabel, onClick, icon: Icon }: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}

export function MarkdownComposer({
  value,
  onChange,
  placeholder,
  className,
  maxLength,
  minHeightClassName = "min-h-28",
}: MarkdownComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const commit = (nextValue: string, selectionStart: number, selectionEnd: number) => {
    if (typeof maxLength === "number" && nextValue.length > maxLength) {
      return;
    }
    onChange(nextValue);
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(selectionStart, selectionEnd);
    });
  };

  const applyWrap = (prefix: string, suffix: string, fallbackText: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end);
    const body = selected || fallbackText;
    const replacement = `${prefix}${body}${suffix}`;
    const nextValue = value.slice(0, start) + replacement + value.slice(end);
    const newStart = start + prefix.length;
    const newEnd = newStart + body.length;

    commit(nextValue, newStart, newEnd);
  };

  const applyLinePrefix = (prefix: string, ordered = false) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start === end) {
      const insertText = ordered ? "1. " : prefix;
      const nextValue = value.slice(0, start) + insertText + value.slice(end);
      const cursor = start + insertText.length;
      commit(nextValue, cursor, cursor);
      return;
    }

    const selected = value.slice(start, end);
    const lines = selected.split("\n");
    const replacement = ordered
      ? lines.map((line, index) => `${index + 1}. ${line}`).join("\n")
      : lines.map((line) => `${prefix}${line}`).join("\n");
    const nextValue = value.slice(0, start) + replacement + value.slice(end);

    commit(nextValue, start, start + replacement.length);
  };

  const applyLink = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end);
    const linkText = selected || "link text";
    const url = window.prompt("Enter link URL", "https://");
    if (!url) return;

    const replacement = `[${linkText}](${url})`;
    const nextValue = value.slice(0, start) + replacement + value.slice(end);
    const textStart = start + 1;
    const textEnd = textStart + linkText.length;

    commit(nextValue, textStart, textEnd);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-input bg-muted/30 p-1">
        <ToolbarButton
          ariaLabel="Bold"
          onClick={() => applyWrap("**", "**", "bold text")}
          icon={Bold}
        />
        <ToolbarButton
          ariaLabel="Italic"
          onClick={() => applyWrap("*", "*", "italic text")}
          icon={Italic}
        />
        <ToolbarButton
          ariaLabel="Underline"
          onClick={() => applyWrap("<ins>", "</ins>", "underlined text")}
          icon={Underline}
        />
        <ToolbarButton
          ariaLabel="Strikethrough"
          onClick={() => applyWrap("~~", "~~", "strikethrough text")}
          icon={Strikethrough}
        />
        <span className="mx-1 h-5 w-px bg-border" />
        <ToolbarButton
          ariaLabel="Insert link"
          onClick={applyLink}
          icon={Link2}
        />
        <ToolbarButton
          ariaLabel="Numbered list"
          onClick={() => applyLinePrefix("", true)}
          icon={ListOrdered}
        />
        <ToolbarButton
          ariaLabel="Bullet list"
          onClick={() => applyLinePrefix("- ")}
          icon={List}
        />
        <ToolbarButton
          ariaLabel="Quote"
          onClick={() => applyLinePrefix("> ")}
          icon={Quote}
        />
        <span className="mx-1 h-5 w-px bg-border" />
        <ToolbarButton
          ariaLabel="Inline code"
          onClick={() => applyWrap("`", "`", "code")}
          icon={Code}
        />
        <ToolbarButton
          ariaLabel="Code block"
          onClick={() => applyWrap("```\n", "\n```", "code block")}
          icon={FileCode2}
        />
      </div>

      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(minHeightClassName)}
        maxLength={maxLength}
      />

      <p className="text-xs text-muted-foreground">
        Use the toolbar or markdown shortcuts. Preview appears in the quest thread.
      </p>
    </div>
  );
}
