const timestampFormat = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function formatTimestamp(iso: string) {
  return timestampFormat.format(new Date(iso))
}
