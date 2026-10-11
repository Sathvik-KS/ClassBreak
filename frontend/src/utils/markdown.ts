// Minimal, safe markdown → HTML renderer for lesson/tutor content.
// Input is escaped FIRST, then a small set of markdown constructs is allowed.
// This prevents XSS from AI-generated or user-supplied text.

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlineFormat(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

export function markdownToHtml(markdown: string): string {
  const lines = escapeHtml(markdown).split(/\r?\n/);
  const out: string[] = [];
  let listOpen = false;
  let para: string[] = [];

  const closeList = () => {
    if (listOpen) {
      out.push('</ul>');
      listOpen = false;
    }
  };
  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${inlineFormat(para.join(' '))}</p>`);
      para = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushPara();
      closeList();
      continue;
    }
    if (line.startsWith('## ')) {
      flushPara();
      closeList();
      out.push(`<h4>${inlineFormat(line.slice(3))}</h4>`);
      continue;
    }
    if (line.startsWith('# ')) {
      flushPara();
      closeList();
      out.push(`<h4>${inlineFormat(line.slice(2))}</h4>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      flushPara();
      if (!listOpen) {
        out.push('<ul>');
        listOpen = true;
      }
      out.push(`<li>${inlineFormat(line.replace(/^[-*]\s+/, ''))}</li>`);
      continue;
    }
    para.push(line);
  }
  flushPara();
  closeList();
  return out.join('\n');
}
