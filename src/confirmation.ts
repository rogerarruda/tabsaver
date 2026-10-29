import { onBeforeUnmount, ref } from 'vue'
export type Confirmation = { title: string; body: string; confirmLabel: string; danger?: boolean }
export function useConfirmation() {
  const confirmation = ref<Confirmation | null>(null)
  const confirmationTarget = ref<HTMLElement | null>(null)
  let finish: ((confirmed: boolean) => void) | null = null
  function requestConfirmation(options: Confirmation): Promise<boolean> {
    if (confirmation.value) return Promise.resolve(false)
    confirmationTarget.value = document.activeElement as HTMLElement
    confirmation.value = options
    return new Promise(resolve => finish = resolve)
  }
  function settleConfirmation(confirmed: boolean) {
    confirmation.value = null
    const resolve = finish; finish = null; resolve?.(confirmed)
  }
  onBeforeUnmount(() => settleConfirmation(false))
  return { confirmation, confirmationTarget, requestConfirmation, settleConfirmation }
}
