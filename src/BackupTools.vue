<script setup lang="ts">
import { computed, nextTick, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { ArrowDownToLine, Upload, X, ShieldCheck, RotateCcw } from '@lucide/vue'
import { createBackup, parseBackup, mergeCollections, summarizeBackup, readBackupStorage, writeBackupStorage, validateSnapshot, backupFingerprint, readBackupMarker, writeBackupMarker, markBackupExport } from './backup'
import { mergeTrash } from './trash'
import type { Backup, Snapshot } from './backup'
const props = defineProps<{ t: (text: string, params?: Record<string, string | number>) => string; locale: string; flushPreferences: () => Promise<void>; revision?: unknown }>()
const emit = defineEmits<{ restored: [snapshot: Snapshot]; notice: [text: string]; modal: [open: boolean] }>()
const restoreButton = ref<HTMLButtonElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const pending = ref<Backup | null>(null)
const filename = ref('')
const mode = ref('merge')
const restorePreferences = ref(false)
const working = ref(false)
const failure = ref('')
const canUndo = ref(false)
const reminder = ref(false)
const lastExport = ref('')
let statusRequest = 0
async function refreshStatus() {
  const request = ++statusRequest
  try { const data = await readBackupStorage(), marker = await readBackupMarker(), hash = await backupFingerprint({ collections: data.collections, preferences: data.preferences, trash: data.trash }); if (request !== statusRequest) return; lastExport.value = marker.date || ''; reminder.value = data.collections.length > 0 && marker.fingerprint !== hash && Date.now() >= (marker.snoozeUntil || 0) } catch { /* Backup actions remain available when status cannot be read. */ }
}
async function snooze() { try { await writeBackupMarker({ ...await readBackupMarker(), snoozeUntil: Date.now() + 24 * 60 * 60 * 1000 }); reminder.value = false } catch { failure.value = props.t('Não foi possível adiar o lembrete.') } }
function storageEvent() { refreshStatus() }
onMounted(() => { if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) chrome.storage.onChanged.addListener(storageEvent); else window.addEventListener('storage', storageEvent) })
onBeforeUnmount(() => { statusRequest++; if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) chrome.storage.onChanged.removeListener(storageEvent); else window.removeEventListener('storage', storageEvent) })
watch(() => props.revision, refreshStatus, { immediate: true })
const summary = computed(() => pending.value ? summarizeBackup(pending.value) : null)
function close() { if (working.value) return; pending.value = null; emit('modal', false); nextTick(() => restoreButton.value?.focus()) }
async function download() {
  if (working.value) return
  working.value = true; failure.value = ''
  try {
    await props.flushPreferences()
    const backup = createBackup(await readBackupStorage())
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob), link = document.createElement('a')
    link.href = url; link.download = `tabsaver-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    emit('notice', props.t('Backup preparado para download.'))
    try { await markBackupExport({ collections: backup.collections, preferences: backup.preferences, trash: backup.trash }); await refreshStatus() } catch { failure.value = props.t('O arquivo foi preparado, mas não foi possível registrar a data da exportação.') }
  } catch { failure.value = props.t('Não foi possível criar o backup. Tente novamente.') } finally { working.value = false }
}
async function chooseFile(event: Event) {
  const input = event.target as HTMLInputElement, file = input.files?.[0]
  input.value = ''
  if (!file || working.value) return
  working.value = true; failure.value = ''
  try {
    if (file.size > 20 * 1024 * 1024) throw new Error('size')
    pending.value = parseBackup(await file.text()); filename.value = file.name; mode.value = 'merge'; restorePreferences.value = false
    emit('modal', true)
  } catch { failure.value = props.t('Arquivo inválido. Escolha um backup JSON do TabSaver de até 20 MB.') } finally { working.value = false }
}
async function restore() {
  if (!pending.value || working.value) return
  working.value = true; failure.value = ''
  try {
    await props.flushPreferences()
    const current = await readBackupStorage()
    const next: Snapshot = { collections: mode.value === 'merge' ? mergeCollections(current.collections, pending.value.collections) : pending.value.collections, preferences: restorePreferences.value ? pending.value.preferences : current.preferences, trash: mode.value === 'merge' ? mergeTrash(current.trash || [], pending.value.trash || []) : pending.value.trash ?? current.trash ?? [] }
    await writeBackupStorage(next, { collections: current.collections, preferences: current.preferences, trash: current.trash })
    emit('restored', next); refreshStatus(); canUndo.value = true; pending.value = null; emit('modal', false); nextTick(() => restoreButton.value?.focus())
    emit('notice', props.t('Backup restaurado. Suas abas abertas não foram alteradas.'))
  } catch { failure.value = props.t('Não foi possível restaurar. Seus dados atuais foram mantidos. Verifique o espaço disponível e tente novamente.') } finally { working.value = false }
}
async function undo() {
  working.value = true; failure.value = ''
  try {
    await props.flushPreferences()
    const current = await readBackupStorage()
    if (!current.backupRecovery) throw new Error('missing')
    const previous = validateSnapshot(current.backupRecovery)
    if (!window.confirm(props.t('Voltar aos dados anteriores à última restauração? Alterações feitas depois dela serão substituídas.'))) return
    await writeBackupStorage(previous, null); emit('restored', previous); refreshStatus(); canUndo.value = false
    emit('notice', props.t('Restauração desfeita.'))
  } catch { failure.value = props.t('Não foi possível desfazer a restauração.') } finally { working.value = false }
}
function trap(event: KeyboardEvent) {
  const items = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)')]
  const first = items[0], last = items[items.length - 1]
  if (!first) { event.preventDefault(); return }
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
readBackupStorage().then(data => canUndo.value = !!data.backupRecovery).catch(() => {})
</script>
<template>
  <section class="backup-toolbar" :aria-label="t('Backup e restauração')">
    <span class="backup-label"><ShieldCheck :size="17" />{{ t('Backup e restauração') }}</span>
    <div class="backup-actions"><button class="button" :disabled="working" @click="download"><ArrowDownToLine :size="15" />{{ t('Exportar backup') }}</button><button ref="restoreButton" class="button" :disabled="working" @click="fileInput?.click()"><Upload :size="15" />{{ t('Restaurar backup') }}</button><button v-if="canUndo" class="text-button" :disabled="working" @click="undo"><RotateCcw :size="14" />{{ t('Desfazer restauração') }}</button></div>
    <div v-if="reminder" class="backup-reminder" role="status"><span>{{ t('Há alterações sem uma exportação recente. Salve um backup.') }}</span><button class="text-button" @click="snooze">{{ t('Lembrar amanhã') }}</button></div><p v-if="lastExport" class="backup-export-date">{{ t('Última exportação preparada:') }} {{ new Date(lastExport).toLocaleString(locale) }}</p><input ref="fileInput" class="sr-only" type="file" accept=".json,application/json" tabindex="-1" :aria-label="t('Escolher arquivo de backup')" @change="chooseFile" />
    <p v-if="failure && !pending" class="backup-error" role="alert">{{ failure }}</p>
  </section>
  <Teleport to="body"><div v-if="pending" class="modal-backdrop" @click.self="close" @keydown.esc="close"><form class="modal backup-modal" role="dialog" aria-modal="true" aria-labelledby="restore-title" @submit.prevent="restore" @keydown.tab="trap"><div class="modal-heading"><span class="folder-tile mint"><ShieldCheck :size="23" /></span><button v-focus type="button" class="icon-button" :disabled="working" :aria-label="t('Fechar')" @click="close"><X :size="20" /></button></div><h2 id="restore-title">{{ t('Restaurar seus dados') }}</h2><p class="backup-filename">{{ filename }}</p><p>{{ summary?.collections }} {{ summary?.collections === 1 ? t('coleção') : t('coleções') }} · {{ summary?.tabs }} {{ summary?.tabs === 1 ? t('aba') : t('abas') }}<br>{{ t('Exportado em') }} {{ new Date(pending.exportedAt).toLocaleString(locale) }}</p><p v-if="pending.trash?.length">{{ t('Itens na lixeira:') }} {{ pending.trash.length }}</p><p v-if="summary?.unreadable" class="backup-warning">{{ t('Algumas abas antigas não puderam ser exibidas. Os dados originais foram preservados.') }}</p><label for="restore-mode">{{ t('Como restaurar?') }}</label><select id="restore-mode" v-model="mode" :disabled="working"><option value="merge">{{ t('Adicionar às coleções atuais') }}</option><option value="replace">{{ t('Substituir todas as coleções') }}</option></select><p class="restore-explanation">{{ mode === 'merge' ? t('Mantém suas coleções e adiciona as do backup, sem repetir coleções idênticas.') : t('Todas as coleções atuais serão substituídas pelas do arquivo.') }}</p><label class="backup-checkbox"><input v-model="restorePreferences" type="checkbox" :disabled="working" />{{ t('Restaurar também as preferências') }}</label><p class="restore-explanation">{{ t('Uma cópia dos dados atuais será guardada para desfazer esta restauração.') }}</p><p v-if="failure" class="backup-error" role="alert">{{ failure }}</p><div class="modal-actions"><button type="button" class="button" :disabled="working" @click="close">{{ t('Cancelar') }}</button><button class="button primary" :disabled="working">{{ working ? t('Restaurando…') : t('Confirmar restauração') }}</button></div></form></div></Teleport>
</template>
<script lang="ts">
export default { directives: { focus: { mounted(el: HTMLElement) { el.focus() } } } }
</script>
