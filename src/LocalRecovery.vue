<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { History, X, RotateCcw } from '@lucide/vue'
import { readLocalRecoveries } from './local-recovery'
import type { LocalRecovery } from './local-recovery'
import { writeAuxiliaryData } from './collection-storage'
import { useConfirmation } from './confirmation'
import ConfirmDialog from './ConfirmDialog.vue'
const props = defineProps<{ t: (text: string, params?: Record<string, string | number>) => string; locale: string }>()
const emit = defineEmits<{ modal: [open: boolean]; restored: [point: LocalRecovery]; notice: [text: string] }>()
const open = ref(false), working = ref(false), failure = ref('')
const points = ref<LocalRecovery[]>([])
const trigger = ref<HTMLButtonElement | null>(null), closeButton = ref<HTMLButtonElement | null>(null)
const { confirmation, confirmationTarget, requestConfirmation, settleConfirmation } = useConfirmation()
async function show() {
  failure.value = ''; open.value = true; emit('modal', true)
  await nextTick(); closeButton.value?.focus()
  try { points.value = await readLocalRecoveries() } catch { failure.value = props.t('Não foi possível carregar os pontos de recuperação.') }
}
async function close() { if (working.value) return; open.value = false; emit('modal', false); await nextTick(); trigger.value?.focus() }
async function restore(point: LocalRecovery) {
  if (working.value) return
  working.value = true
  try {
    if (!await requestConfirmation({ title: props.t('Restaurar este ponto de recuperação?'), body: props.t('Coleções e lixeira serão substituídas pela cópia escolhida. Uma cópia dos dados atuais será criada antes de restaurar. As abas abertas não serão alteradas.'), confirmLabel: props.t('Restaurar dados') })) return
    await writeAuxiliaryData({ collections: point.collections, trash: point.trash, lastDeleted: null })
    emit('restored', point); emit('notice', props.t('Ponto de recuperação restaurado.')); points.value = await readLocalRecoveries()
  } catch { failure.value = props.t('Não foi possível restaurar. Os dados foram preservados.') } finally { working.value = false }
}
function trap(event: KeyboardEvent) {
  const items = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
  const first = items[0], last = items[items.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
</script>
<template>
  <button ref="trigger" class="text-button" @click="show"><History :size="15" />{{ t('Recuperação local') }}</button>
  <Teleport to="body"><div v-if="open" class="modal-backdrop" @click.self="close" @keydown.esc="!confirmation && close()"><section class="modal recovery-modal" role="dialog" aria-modal="true" aria-labelledby="recovery-title" :inert="!!confirmation || undefined" @keydown.tab="trap"><div class="modal-heading"><span class="folder-tile mint"><History :size="23" /></span><button ref="closeButton" class="icon-button" :disabled="working" :aria-label="t('Fechar')" @click="close"><X :size="20" /></button></div><h2 id="recovery-title">{{ t('Recuperação local') }}</h2><p>{{ t('Até 5 cópias recentes são criadas automaticamente antes de alterar coleções ou a lixeira. O histórico pode ser menor para bibliotecas grandes.') }}</p><p>{{ t('Estas cópias ficam neste navegador. Exporte um backup para proteger seus dados contra desinstalação ou perda do perfil.') }}</p><p v-if="failure" role="alert" class="backup-error">{{ failure }}</p><p v-if="!points.length && !failure">{{ t('Ainda não há pontos de recuperação. Eles aparecerão após a próxima alteração.') }}</p><div v-for="point in points" :key="point.id" class="recovery-point"><span><strong>{{ new Date(point.date).toLocaleString(locale) }}</strong><small>{{ t('Coleções: {count}', { count: point.collections.length }) }}</small></span><button class="button" :disabled="working" @click="restore(point)"><RotateCcw :size="14" />{{ t('Restaurar') }}</button></div></section></div><ConfirmDialog v-if="confirmation" :options="confirmation" :return-focus="confirmationTarget" :cancel-label="t('Cancelar')" @result="settleConfirmation" /></Teleport>
</template>
