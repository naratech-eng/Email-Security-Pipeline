/**
 * Defang URLs/hosts so a phishing tool never renders a live, clickable link.
 * http→hxxp, https→hxxps, and every dot → [.]. Rendered as plain text only —
 * never as an anchor, never via dangerouslySetInnerHTML.
 */
export function defangUrl(url: string): string {
  return url
    .replace(/^https:\/\//i, 'hxxps://')
    .replace(/^http:\/\//i, 'hxxp://')
    .replace(/\./g, '[.]');
}

/** Defang any free text that may contain a domain (e.g. a sender address). */
export function defangText(text: string): string {
  return text.replace(/\./g, '[.]');
}
