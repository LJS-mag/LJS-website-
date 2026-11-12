/* "a month ago" labels. The build only knows a date, so the label is worked out in the visitor's browser. */
export const ago = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso + 'T00:00:00').getTime()) / 864e5);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 7) return d + ' days ago';
  if (d < 14) return 'a week ago';
  if (d < 30) return Math.floor(d / 7) + ' weeks ago';
  if (d < 60) return 'a month ago';
  if (d < 365) return Math.floor(d / 30) + ' months ago';
  return d < 730 ? 'a year ago' : Math.floor(d / 365) + ' years ago';
};

export function labelTimes(root: ParentNode = document) {
  root.querySelectorAll<HTMLTimeElement>('time[data-ago]').forEach((t) => {
    if (t.dateTime) t.textContent = ago(t.dateTime);
  });
}
