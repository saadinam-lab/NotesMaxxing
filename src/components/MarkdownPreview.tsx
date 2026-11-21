import { Fragment } from 'react';

function renderInline(text: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    keyIdx += 1;
    if (token.startsWith('`') && token.endsWith('`')) {
      tokens.push(
        <code
          key={keyIdx}
          className="rounded-md bg-[var(--nm-surface-subtle)] px-1.5 py-0.5 font-mono-num text-[13.5px] text-[var(--nm-accent)]"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      tokens.push(
        <strong key={keyIdx} className="font-semibold text-[var(--nm-text)]">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      tokens.push(
        <em key={keyIdx} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }
  return tokens;
}

export function MarkdownPreview({ content }: { content: string }) {
  const trimmed = content.trim();
  if (!trimmed) {
    return (
      <p className="text-[15px] leading-[1.6] italic text-[var(--nm-text-muted)]">
        No note text yet. Switch to Edit to write study explanations or markdown bullets.
      </p>
    );
  }

  const lines = trimmed.split('\n');
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    key += 1;
    blocks.push(
      <ul key={`ul-${key}`} className="my-2 list-disc space-y-1.5 pl-5 text-[15px] leading-[1.6] text-[var(--nm-text)]">
        {listItems.map((item, idx) => (
          <li key={idx}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (/^\s*[-*]\s+/.test(line)) {
      listItems.push(line.replace(/^\s*[-*]\s+/, ''));
      continue;
    }
    flushList();
    key += 1;

    if (!line.trim()) {
      blocks.push(<div key={`sp-${key}`} className="h-2.5" />);
    } else if (line.startsWith('### ')) {
      blocks.push(
        <h4 key={`h3-${key}`} className="nm-heading mt-2.5 mb-1 text-[15px] font-semibold text-[var(--nm-text)]">
          {renderInline(line.slice(4))}
        </h4>,
      );
    } else if (line.startsWith('## ')) {
      blocks.push(
        <h3 key={`h2-${key}`} className="nm-heading mt-2.5 mb-1 text-[16px] font-semibold text-[var(--nm-text)]">
          {renderInline(line.slice(3))}
        </h3>,
      );
    } else if (line.startsWith('# ')) {
      blocks.push(
        <h2 key={`h1-${key}`} className="nm-heading mt-2.5 mb-1 text-[17px] font-bold text-[var(--nm-text)]">
          {renderInline(line.slice(2))}
        </h2>,
      );
    } else if (line.startsWith('> ')) {
      blocks.push(
        <blockquote
          key={`bq-${key}`}
          className="my-1.5 border-l-2 border-[var(--nm-accent)] pl-3 text-[15px] leading-[1.6] italic text-[var(--nm-text-muted)]"
        >
          {renderInline(line.slice(2))}
        </blockquote>,
      );
    } else {
      blocks.push(
        <p key={`p-${key}`} className="text-[15px] leading-[1.6] text-[var(--nm-text)]">
          {renderInline(line)}
        </p>,
      );
    }
  }
  flushList();

  return <Fragment>{blocks}</Fragment>;
}
