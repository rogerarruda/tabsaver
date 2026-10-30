import type { Tab } from './collections'

// Pause between small batches so the browser can process the pages already opened.
export async function restoreTabs(tabs: Tab[], options: {
  open: (tab: Tab) => Promise<boolean>
  cancelled: () => boolean
  progress: (attempted: number, total: number) => void
  pause?: () => Promise<void>
}) {
  let opened = 0, attempted = 0
  for (const tab of tabs) {
    if (options.cancelled()) break
    if (attempted > 0 && attempted % 5 === 0) {
      await (options.pause?.() ?? new Promise<void>(resolve => setTimeout(resolve, 1000)))
      if (options.cancelled()) break
    }
    try { if (await options.open(tab)) opened++ } catch { /* A failed page must not stop the remaining pages. */ }
    options.progress(++attempted, tabs.length)
  }
  return { opened, attempted, cancelled: attempted < tabs.length }
}
