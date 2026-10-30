<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { AlertTriangle } from '@lucide/vue'
import type { Confirmation } from './confirmation'
const props = defineProps<{ options: Confirmation; cancelLabel: string; returnFocus?: HTMLElement | null }>()
const emit = defineEmits<{ result: [confirmed: boolean] }>()
const cancel = ref<HTMLButtonElement | null>(null)
let previous: HTMLElement | null = null
onMounted(() => { previous = props.returnFocus || document.activeElement as HTMLElement; cancel.value?.focus() })
onBeforeUnmount(() => { const target = previous; nextTick(() => { if (target?.isConnected) target.focus() }) })
function trap(event: KeyboardEvent) {
  const buttons = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('button')]
  const first = buttons[0], last = buttons[buttons.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
</script>
<template><Teleport to="body"><div class="modal-backdrop" @click.self="emit('result', false)" @keydown.esc.stop="emit('result', false)"><section class="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-body" @keydown.tab="trap"><span class="confirm-symbol"><AlertTriangle :size="24" /></span><h2 id="confirm-title">{{ options.title }}</h2><p id="confirm-body">{{ options.body }}</p><div class="modal-actions"><button ref="cancel" class="button" @click="emit('result', false)">{{ cancelLabel }}</button><button class="button" :class="options.danger ? 'danger' : 'primary'" @click="emit('result', true)">{{ options.confirmLabel }}</button></div></section></div></Teleport></template>
