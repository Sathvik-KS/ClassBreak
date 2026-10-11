import { markdownToHtml } from '../utils/markdown';

/** Renders markdown (escaped first — XSS-safe) as styled HTML. */
export function Markdown({ source }: { source: string }) {
  return <div className="md" dangerouslySetInnerHTML={{ __html: markdownToHtml(source) }} />;
}
