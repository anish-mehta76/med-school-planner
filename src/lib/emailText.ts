/** Helpers for showing and copying draft emails that contain Markdown links: [title](url). */

const LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

export type EmailSegment = { text: string } | { text: string; url: string };

/** Splits text into plain and link segments so the preview can render real links. */
export function emailSegments(body: string): EmailSegment[] {
  const out: EmailSegment[] = [];
  let last = 0;
  for (const m of body.matchAll(LINK)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: body.slice(last, i) });
    out.push({ text: m[1], url: m[2] });
    last = i + m[0].length;
  }
  if (last < body.length) out.push({ text: body.slice(last) });
  return out;
}

/** Converts Markdown links to "title (url)" for pasting into an email client. */
export function plainEmailText(body: string): string {
  return body.replace(LINK, (_, title: string, url: string) => `${title} (${url})`);
}
