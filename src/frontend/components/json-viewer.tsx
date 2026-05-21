'use client';

type JsonViewerProps = {
  title: string;
  value: unknown;
  defaultOpen?: boolean;
};

export function JsonViewer({ title, value, defaultOpen = false }: JsonViewerProps) {
  return (
    <details className="jsonViewer" open={defaultOpen}>
      <summary>{title}</summary>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}

