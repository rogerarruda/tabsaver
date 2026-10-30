<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue'
import { Layers, LayoutGrid, Search, Plus, ArrowUpRight, X, Leaf, Folder, ChevronDown, ArrowDownToLine, Pencil, Trash2, Check, HardDrive, Clock3, Languages, SunMoon, Star, GripVertical, Zap, Keyboard, Pin, Rows3 } from 'lucide-vue-next'

import LocalRecovery from './LocalRecovery.vue'
import BackupTools from './BackupTools.vue'
import Tutorial from './Tutorial.vue'
import SiteIcon from './SiteIcon.vue'
import CollectionPicker from './CollectionPicker.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import TrashPanel from './TrashPanel.vue'
import { readTrash, deletedCollection, deletedTab, restoreDeleted, migrateLastDeleted } from './trash'
import type { TrashEntry } from './trash'
import { captureTabs, createBrowserOpener } from './browser-tabs'
import { restoreTabs } from './restore-tabs'
import { useConfirmation } from './confirmation'
import brandIcon from '../images/tabsaver-icon.svg'
import type { Snapshot } from './backup'
import { usePreferences } from './preferences'

import { writeCollectionData, writeAuxiliaryData } from './collection-storage'
import { readCollections, writeCollections, appendTabs, replaceTabs, moveSavedTab, manualTab, parseTags, uniqueTabs, pinFirst, searchSavedTabs, savedTab } from './collections'
import type { Tab, Collection } from './collections'
const { confirmation, confirmationTarget, requestConfirmation, settleConfirmation } = useConfirmation()
const openTabs = ref<Tab[]>([])
const saveDestination = ref('new')
const dragged = ref<{ source: string; index: number; url: string } | null>(null)
const dropOver = ref('')
const excludedTabs = ref<number[]>([])
const closeAfterSave = ref(true)
const ignoreDuplicates = ref(true)
const duplicateCount = computed(() => selectedTabs.value.length - uniqueTabs(selectedTabs.value, collections.value.find(c => c.key === saveDestination.value)?.tabs || []).length)
const selectedTabs = computed(() => openTabs.value.filter(tab => !excludedTabs.value.includes(tab.id!)))
function selectTab(tab: Tab) { const id = tab.id!; excludedTabs.value = excludedTabs.value.includes(id) ? excludedTabs.value.filter(value => value !== id) : [...excludedTabs.value, id] }
const collections = ref<Collection[]>([])
const query = ref('')
const searchLimit = ref(50)
const searchResults = computed(() => searchSavedTabs(collections.value, query.value))
watch(query, () => searchLimit.value = 50)
function revealResult(collection: Collection) { query.value = ''; selected.value = collection.key!; expanded.value = [collection.key!] }

const sort = ref('newest')
const selected = ref('all')
const expanded = ref<string[]>([])
const savedSelection = ref<Record<string, number[]>>({})
watch(collections, () => savedSelection.value = {})
function selectedSaved(collection: Collection) { return collection.tabs.filter((_, index) => (savedSelection.value[collection.key!] || []).includes(index)) }
function selectSaved(collection: Collection, index: number) {
  const key = collection.key!, indices = savedSelection.value[key] || []
  savedSelection.value[key] = indices.includes(index) ? indices.filter(i => i !== index) : [...indices, index]
}
function selectAllSaved(collection: Collection) { savedSelection.value[collection.key!] = selectedSaved(collection).length === collection.tabs.length ? [] : collection.tabs.map((_, index) => index) }

const dialog = ref(false)
const backupDialog = ref(false)
const recoveryDialog = ref(false)
const tutorialDialog = ref(false)
const shortcutDialog = ref(false)
const shortcutTrigger = ref<HTMLButtonElement | null>(null)
const shortcutBindings = ref<Record<string, string>>({})
const quickRequest = ref(false)
const editing = ref<Collection | null>(null)
const name = ref('')
const tags = ref('')
const notes = ref('')
const busy = ref(false)
const restoreProgress = ref<{ attempted: number; total: number } | null>(null)
const cancelRestore = ref(false)
const loading = ref(true)
const message = ref('')
const error = ref('')
const storageUnavailable = ref(false)
const trash = ref<TrashEntry[]>([])
const trashAvailable = ref(true)
const { language, theme, density, locale, t, loadPreferences, applyPreferences, flushPreferences } = usePreferences(text => error.value = text)
let noticeTimer: ReturnType<typeof setTimeout>
const extension = typeof chrome !== 'undefined' && !!chrome.storage?.local && !!chrome.tabs
const totalTabs = computed(() => collections.value.reduce((sum, c) => sum + c.tabs.length, 0))
const visible = computed(() => collections.value.filter(c => (selected.value === 'all' || (selected.value === 'favorites' ? c.favorite : c.key === selected.value)) && `${c.name} ${c.notes || ''} ${(c.tags || []).join(' ')} ${c.tabs.map(t => `${t.title} ${t.url}`).join(' ')}`.toLocaleLowerCase().includes(query.value.toLocaleLowerCase())).sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || Number(b.favorite) - Number(a.favorite) || (sort.value === 'name' ? a.name.localeCompare(b.name, locale.value) : (sort.value === 'oldest' ? 1 : -1) * (new Date(a.date).getTime() - new Date(b.date).getTime()))))
const heading = computed(() => selected.value === 'favorites' ? t('Favoritos') : selected.value === 'all' ? t('Suas coleções') : collections.value.find(c => c.key === selected.value)?.name || t('Suas coleções'))
function notify(text: string) { message.value = text; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => message.value = '', 4500) }
function domain(url: string) { try { return new URL(url).hostname.replace(/^www\./, '') || t('Página do navegador') } catch { return t('Página do navegador') } }
function dateLabel(date: string) { if (!Number.isFinite(new Date(date).getTime())) return '—'; return new Date(date).toLocaleDateString(locale.value, { day: 'numeric', month: 'short', year: 'numeric' }) }
async function refreshTabs() {
  if (!extension) return
  try { const tabs = await chrome.tabs.query({ currentWindow: true }); openTabs.value = await captureTabs(tabs.filter(t => t.url && !t.url.startsWith('chrome-extension://') && !t.url.startsWith('chrome://newtab')), chrome.tabGroups?.get ? id => chrome.tabGroups.get(id) : undefined); return true } catch { error.value = t('Não foi possível carregar as abas. Recarregue esta página.'); return false }
}
async function persist(next: Collection[], keepExpanded = false, extra: Record<string, unknown> = {}) {
  if (storageUnavailable.value) throw new Error('Storage could not be read safely')
  const stored = writeCollections(next)
  await writeCollectionData(stored, extra)
  collections.value = readCollections(stored)
  if (!keepExpanded) { selected.value = 'all'; expanded.value = [] }
}
function trapFocus(event: KeyboardEvent) {
  const items = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, [href], select')]
  const first = items[0], last = items[items.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
function startEdit(collection: Collection | null = null) { editing.value = collection; name.value = collection?.name || ''; tags.value = (collection?.tags || []).join(', '); notes.value = collection?.notes || '';  dialog.value = true }
async function submitCollection() {
  if (!name.value.trim() || busy.value) return
  busy.value = true
  try {
    if (editing.value && (editing.value.source === null || typeof editing.value.source !== 'object')) throw new Error('Invalid legacy collection')
    const next = editing.value ? collections.value.map(c => c.key === editing.value!.key ? { ...c, name: name.value.trim(), renamed: true, tags: parseTags(tags.value), notes: notes.value.trim(), metadataChanged: true } : c) : [...collections.value, { name: name.value.trim(), tabs: [], tags: parseTags(tags.value), notes: notes.value.trim(), date: new Date().toISOString() }]
    await persist(next); dialog.value = false; notify(editing.value ? t('Coleção atualizada.') : t('Coleção criada.'))
  } catch { error.value = t('Não foi possível salvar a coleção. Tente novamente.') } finally { busy.value = false }
}
async function saveTabs(quick = false) {
  if (busy.value || (extension && !await refreshTabs())) return
  if (!(quick ? openTabs.value : selectedTabs.value).length || busy.value) return
  const snapshot = [...(quick ? openTabs.value : selectedTabs.value)], destinationKey = quick ? 'new' : saveDestination.value, shouldClose = quick || closeAfterSave.value, skipDuplicates = quick || ignoreDuplicates.value
  const originalDestination = collections.value.find(c => c.key === destinationKey)
  if (shouldClose && !await requestConfirmation({ title: quick ? t('Salvar todas as abas em uma nova coleção?') : t('Salvar e fechar as abas selecionadas?'), body: t('Abas a salvar e fechar: {count}. A página do TabSaver continua aberta.', { count: snapshot.length }), confirmLabel: t('Salvar e fechar') })) return
  busy.value = true; error.value = ''
  try {
    const date = new Date()
    const destination = collections.value.find(c => c.key === destinationKey)
    if (destinationKey !== 'new' && (!destination || !originalDestination || JSON.stringify(writeCollections([destination])) !== JSON.stringify(writeCollections([originalDestination])))) throw new Error('Destination changed')
    const tabsToSave = skipDuplicates ? uniqueTabs(snapshot, destination?.tabs) : snapshot
    await persist(destination ? collections.value.map(c => c.key === destination.key ? appendTabs(c, tabsToSave) : c) : [...collections.value, { name: t('Sessão de {date} · {time}', { date: date.toLocaleDateString(locale.value, { day: 'numeric', month: 'short' }), time: date.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' }) }), tabs: tabsToSave.map(savedTab), date: date.toISOString() }])
    saveDestination.value = 'new'
    if (extension && shouldClose) { const current = await chrome.tabs.getCurrent(); const ids = snapshot.filter(t => t.id !== current?.id && t.id !== undefined).map(t => t.id!); if (ids.length) await chrome.tabs.remove(ids); await refreshTabs() }
    selected.value = 'all'; notify(t('Abas salvas. Tudo organizado!'))
  } catch { error.value = t('Não foi possível concluir. Confira a coleção salva antes de tentar novamente.') } finally { busy.value = false }
}
async function quickSaveTabs() {
  if (busy.value || loading.value || dialog.value || backupDialog.value || recoveryDialog.value || tutorialDialog.value || shortcutDialog.value || confirmation.value) return
  if (extension && !await refreshTabs()) return
  if (!openTabs.value.length) { notify(t('Não há abas abertas para salvar nesta janela.')); return }
  await saveTabs(true)
}
async function readShortcuts() {
  if (!extension || !chrome.commands?.getAll) return
  try { const commands = await chrome.commands.getAll(); shortcutBindings.value = Object.fromEntries(commands.map(command => [command.name || '', command.shortcut || ''])) } catch { /* The configuration link remains available. */ }
}
async function openShortcutHelp() { await readShortcuts(); shortcutDialog.value = true }
async function closeShortcutHelp() { shortcutDialog.value = false; await nextTick(); shortcutTrigger.value?.focus() }
async function configureShortcuts() {
  try { if (extension) await chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }); else notify(t('No Chrome, abra chrome://extensions/shortcuts para configurar os atalhos.')) }
  catch { error.value = t('No Chrome, abra chrome://extensions/shortcuts para configurar os atalhos.') }
}
function receiveQuickRequest() {
  if (location.hash !== '#quick-save') return
  history.replaceState(null, '', location.pathname + location.search)
  quickRequest.value = true
}
watch([quickRequest, loading, busy, dialog, backupDialog, recoveryDialog, tutorialDialog, shortcutDialog, confirmation], () => {
  if (!quickRequest.value || loading.value || busy.value || dialog.value || backupDialog.value || recoveryDialog.value || tutorialDialog.value || shortcutDialog.value || confirmation.value) return
  quickRequest.value = false
  quickSaveTabs()
}, { flush: 'post' })
async function openTab(url: string, active = true): Promise<boolean> {
  try { if (extension) await chrome.tabs.create({ url, active }); else window.open(url, '_blank', 'noopener,noreferrer'); return true }
  catch { error.value = t('Não foi possível abrir esta aba.'); return false }
}
async function restore(collection: Collection, tabs = collection.tabs) {
  const snapshot = [...tabs]
  if (busy.value) return
  busy.value = true
  try {
    const current = extension ? (await chrome.tabs.query({ currentWindow: true })).filter(tab => tab.url).map(tab => ({ title: tab.title || '', url: tab.url! })) : []
    let pending = uniqueTabs(snapshot, current)
    if (pending.length >= 10) {
      if (!await requestConfirmation({ title: t('Abrir muitas abas?'), body: t('Serão abertas {count} abas de “{name}”. Isso pode consumir bastante memória e deixar o computador lento. Deseja continuar?', { count: pending.length, name: collection.name }), confirmLabel: t('Abrir abas') })) return
      const fresh = extension ? (await chrome.tabs.query({ currentWindow: true })).filter(tab => tab.url).map(tab => ({ title: tab.title || '', url: tab.url! })) : []
      pending = uniqueTabs(pending, fresh)
    }
    cancelRestore.value = false
    restoreProgress.value = { attempted: 0, total: pending.length }
    const opener = extension ? createBrowserOpener(chrome, (await chrome.tabs.getCurrent())?.windowId) : null
    const result = await restoreTabs(pending, { open: tab => opener ? opener.open(tab) : openTab(tab.url, false), cancelled: () => cancelRestore.value, progress: (attempted, total) => restoreProgress.value = { attempted, total } })
    if (opener?.groupFailures) error.value = t('As páginas foram abertas, mas alguns grupos não puderam ser recriados.')
    notify(result.cancelled ? t('Abertura interrompida. Abas abertas: {count}.', { count: result.opened }) : t('Abas abertas: {count}. Ignoradas: {skipped}.', { count: result.opened, skipped: snapshot.length - pending.length }))
  } catch { error.value = t('Não foi possível abrir esta aba.') } finally { restoreProgress.value = null; busy.value = false }
}
async function closeTab(tab: Tab) {
  if (busy.value || !await requestConfirmation({ title: t('Fechar esta aba?'), body: t('“{title}” será fechada sem salvamento automático.', { title: tab.title }), confirmLabel: t('Fechar aba'), danger: true })) return
  busy.value = true
  try { if (extension && tab.id !== undefined) { await chrome.tabs.remove(tab.id); await refreshTabs() } } catch { error.value = t('Não foi possível fechar esta aba.') } finally { busy.value = false }
}
async function copyOriginal(collection: Collection) {
  try { await navigator.clipboard.writeText(JSON.stringify(collection.source, null, 2) ?? 'null'); notify(t('Dados originais copiados.')) }
  catch { error.value = t('Não foi possível copiar. Selecione o texto dos dados originais e copie manualmente.') }
}
async function pin(collection: Collection) {
  if (busy.value) return
  busy.value = true
  try { await persist(collections.value.map(c => c.key === collection.key ? { ...c, pinned: !c.pinned, metadataChanged: true } : c), true) }
  catch { error.value = t('Não foi possível salvar a coleção. Tente novamente.') } finally { busy.value = false }
}
async function favorite(collection: Collection) {
  if (busy.value || !collection.source || typeof collection.source !== 'object') return
  busy.value = true
  try { await persist(collections.value.map(c => c.key === collection.key ? { ...c, favorite: !c.favorite, metadataChanged: true } : c), true) }
  catch { error.value = t('Não foi possível salvar a coleção. Tente novamente.') } finally { busy.value = false }
}
function ensureCollection(collection: Collection) {
  const current = collections.value.find(c => c.key === collection.key)
  if (!current || JSON.stringify(writeCollections([current])) !== JSON.stringify(writeCollections([collection]))) throw new Error('Collection changed')
}
function loadTrash(value: unknown) {
  try { trash.value = readTrash(value); trashAvailable.value = true }
  catch { trashAvailable.value = false; error.value = t('Não foi possível carregar a lixeira. Recarregue para tentar novamente.') }
}
async function restoreTrashItem(entry: TrashEntry) {
  if (busy.value || !trashAvailable.value) return
  busy.value = true
  try { const remaining = trash.value.filter(item => item.id !== entry.id); await persist(restoreDeleted(collections.value, entry), false, { trash: remaining, lastDeleted: null }); trash.value = remaining; notify(t('Item restaurado.')) }
  catch { error.value = t('Não foi possível restaurar o item. Os dados foram preservados.') } finally { busy.value = false }
}
async function permanentlyDelete(entry?: TrashEntry) {
  if (busy.value || !trashAvailable.value || !await requestConfirmation({ title: entry ? t('Excluir definitivamente?') : t('Esvaziar a lixeira?'), body: t('Os itens serão removidos da lixeira e não poderão ser restaurados por ela.'), confirmLabel: entry ? t('Excluir definitivamente') : t('Esvaziar lixeira'), danger: true })) return
  busy.value = true
  try { const remaining = entry ? trash.value.filter(item => item.id !== entry.id) : []; await writeAuxiliaryData({ trash: remaining, lastDeleted: null }); trash.value = remaining; notify(t('Lixeira atualizada.')) }
  catch { error.value = t('Não foi possível atualizar a lixeira.') } finally { busy.value = false }
}
async function remove(collection: Collection) {
  if (busy.value || !trashAvailable.value || !await requestConfirmation({ title: t('Mover coleção para a lixeira?'), body: t('A coleção “{name}” contém {count} abas. Você poderá restaurá-la na lixeira.', { name: collection.name, count: collection.tabs.length }), confirmLabel: t('Mover para lixeira'), danger: true })) return
  busy.value = true
  try {
    ensureCollection(collection)
    const nextTrash = [...trash.value, deletedCollection(collection, collections.value.findIndex(c => c.key === collection.key))]
    await persist(collections.value.filter(c => c.key !== collection.key), false, { trash: nextTrash, lastDeleted: null })
    trash.value = nextTrash; notify(t('Coleção movida para a lixeira.'))
  } catch { error.value = t('Não foi possível mover para a lixeira. Os dados foram preservados.') } finally { busy.value = false }
}
async function deleteSavedTab(collection: Collection, index: number) {
  if (busy.value || !trashAvailable.value || !await requestConfirmation({ title: t('Mover aba para a lixeira?'), body: collection.tabs[index]?.title || '', confirmLabel: t('Mover para lixeira'), danger: true })) return
  busy.value = true
  try { ensureCollection(collection); const nextTrash = [...trash.value, deletedTab(collection, index)]; await persist(collections.value.map(c => c.key === collection.key ? replaceTabs(c, c.tabs.filter((_, i) => i !== index)) : c), true, { trash: nextTrash }); trash.value = nextTrash; notify(t('Aba movida para a lixeira.')) }
  catch { error.value = t('Não foi possível mover para a lixeira. Os dados foram preservados.') } finally { busy.value = false }
}
function beginDrag(collection: Collection, index: number, event: DragEvent) {
  if (busy.value || collection.unreadableTabs || !event.dataTransfer) { event.preventDefault(); return }
  dragged.value = { source: collection.key!, index, url: collection.tabs[index].url }
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', collection.tabs[index].url)
}
function endDrag() { dragged.value = null; dropOver.value = '' }
function allowDrop(collection: Collection, event: DragEvent) {
  if (!dragged.value || busy.value || collection.unreadableTabs || dragged.value.source === collection.key) return
  event.preventDefault(); dropOver.value = collection.key!; if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
}
async function dropTab(collection: Collection) {
  const item = dragged.value
  endDrag()
  if (!item || busy.value || collection.key === item.source || collection.unreadableTabs) return
  if (collections.value.find(c => c.key === item.source)?.tabs[item.index]?.url !== item.url) return
  busy.value = true
  try { await persist(moveSavedTab(collections.value, item.source, collection.key!, item.index), true); notify(t('Aba movida.')) }
  catch { error.value = t('Não foi possível editar esta coleção. Os dados foram preservados.') } finally { busy.value = false }
}
async function moveTab(collection: Collection, index: number, event: Event) {
  const input = event.target as HTMLSelectElement, destination = input.value
  input.value = ''
  if (!destination || busy.value) return
  busy.value = true
  try { await persist(moveSavedTab(collections.value, collection.key!, destination, index), true); notify(t('Aba movida.')) }
  catch { error.value = t('Não foi possível editar esta coleção. Os dados foram preservados.') } finally { busy.value = false }
}
async function addTab(collection: Collection, event: Event) {
  if (busy.value) return
  const form = event.target as HTMLFormElement, data = new FormData(form)
  busy.value = true
  try { const tab = manualTab(String(data.get('title') || ''), String(data.get('url') || '')); await persist(collections.value.map(c => c.key === collection.key ? appendTabs(c, [tab]) : c), true); form.reset(); notify(t('Aba adicionada.')) }
  catch { error.value = t('Não foi possível adicionar. Use um endereço http ou https válido.') } finally { busy.value = false }
}
function toggle(date: string) { expanded.value = expanded.value.includes(date) ? expanded.value.filter(d => d !== date) : [...expanded.value, date] }
function loadCollections(value: unknown) {
  try { collections.value = readCollections(value); storageUnavailable.value = false; endDrag(); saveDestination.value = 'new' }
  catch { storageUnavailable.value = true; error.value = t('Não foi possível carregar suas coleções. Recarregue para tentar novamente.') }
}
function backupRestored(snapshot: Snapshot) { loadCollections(snapshot.collections); applyPreferences(snapshot.preferences); selected.value = 'all'; expanded.value = []; query.value = ''; error.value = ''; if (snapshot.trash) loadTrash(snapshot.trash) }
function storageChanged(changes: { [key: string]: chrome.storage.StorageChange }, area: string) { if (area === 'local') { if (changes.collections) loadCollections(changes.collections.newValue ?? []); if (changes.trash) loadTrash(changes.trash.newValue ?? []) } }
onMounted(async () => {
  await loadPreferences()
  await readShortcuts()
  window.addEventListener('hashchange', receiveQuickRequest)
  window.addEventListener('focus', readShortcuts)
  receiveQuickRequest()
  try {
    if (extension) { const data = await chrome.storage.local.get({ collections: [], trash: [], lastDeleted: null }); loadCollections(data.collections); loadTrash(data.trash); if (trashAvailable.value && data.lastDeleted) { const migrated = migrateLastDeleted(trash.value, data.lastDeleted); await writeAuxiliaryData({ trash: migrated, lastDeleted: null }); loadTrash(migrated) }; await refreshTabs(); chrome.tabs.onCreated.addListener(refreshTabs); chrome.tabs.onRemoved.addListener(refreshTabs); chrome.tabs.onUpdated.addListener(refreshTabs); chrome.storage.onChanged.addListener(storageChanged) }
    else { loadCollections(JSON.parse(localStorage.getItem('tabsaver-preview') || '[]')); loadTrash(JSON.parse(localStorage.getItem('tabsaver-trash') || '[]')); const previous = JSON.parse(localStorage.getItem('tabsaver-lastDeleted') || 'null'); if (trashAvailable.value && previous) { const migrated = migrateLastDeleted(trash.value, previous); await writeAuxiliaryData({ trash: migrated, lastDeleted: null }); loadTrash(migrated) } }
  } catch { storageUnavailable.value = true; error.value = t('Não foi possível carregar suas coleções. Recarregue para tentar novamente.') } finally { loading.value = false }
})
onBeforeUnmount(() => { cancelRestore.value = true; clearTimeout(noticeTimer); window.removeEventListener('hashchange', receiveQuickRequest); window.removeEventListener('focus', readShortcuts); if (extension) { chrome.tabs.onCreated.removeListener(refreshTabs); chrome.tabs.onRemoved.removeListener(refreshTabs); chrome.tabs.onUpdated.removeListener(refreshTabs); chrome.storage.onChanged.removeListener(storageChanged) } })
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar" :inert="dialog || backupDialog || recoveryDialog || tutorialDialog || shortcutDialog || !!confirmation || undefined">
      <a class="brand" href="#" @click.prevent="selected = 'all'"><img class="brand-logo" :src="brandIcon" alt="" width="37" height="37" />TabSaver<span class="brand-dot">.</span></a>
      <div class="workspace-label">{{ t('SEU ESPAÇO') }}</div>
      <button class="nav-item" :class="{ active: selected === 'all' }" @click="selected = 'all'"><LayoutGrid :size="18" /> {{ t('Todas as coleções') }} <span class="nav-count">{{ collections.length }}</span></button>
      <button class="nav-item" :class="{ active: selected === 'favorites' }" @click="selected = 'favorites'"><Star :size="18" />{{ t('Favoritos') }}<span class="nav-count">{{ collections.filter(c => c.favorite).length }}</span></button><button class="nav-item" :class="{ active: selected === 'trash' }" @click="selected = 'trash'"><Trash2 :size="17" />{{ t('Lixeira') }}<span class="nav-count">{{ trash.length }}</span></button><div class="sidebar-section"><span>{{ t('COLEÇÕES') }}</span><button class="icon-button" :aria-label="t('Criar coleção')" @click="startEdit()"><Plus :size="17" /></button></div>
      <nav class="collection-nav" :aria-label="t('Coleções')">
        <button v-for="collection in pinFirst([...collections].sort((a,b) => b.date.localeCompare(a.date)))" :key="collection.key" class="nav-item" :class="{ active: selected === collection.key, 'drop-over': dropOver === collection.key }" @dragover="allowDrop(collection, $event)" @dragleave="dropOver = ''" @drop.prevent="dropTab(collection)" @click="selected = collection.key!"><Folder :size="17" /><span class="nav-name">{{ collection.name }}</span><span class="nav-count">{{ collection.tabs.length }}</span></button>
        <p v-if="!collections.length" class="sidebar-empty">{{ t('Um lugar para cada ideia.') }}<br>{{ t('Crie sua primeira coleção.') }}</p>
      </nav>
      <div class="local-note"><span class="local-icon"><HardDrive :size="18" /></span><div><strong>{{ t('Salvo neste navegador') }}</strong><p>{{ t('Suas abas ficam no seu dispositivo.') }}</p></div><span class="status-dot"></span></div>
      <div class="sidebar-footer"><span>{{ t('Menos abas. Mais espaço.') }}</span><Leaf :size="15" /></div>
    </aside>

    <main :inert="dialog || backupDialog || recoveryDialog || tutorialDialog || shortcutDialog || !!confirmation || undefined">
      <header class="topbar"><span class="breadcrumb">{{ t('Meu espaço') }} <span>/</span> <strong>{{ t('Coleções') }}</strong></span><div class="topbar-controls"><span class="local-badge"><span class="status-dot"></span> {{ t('Armazenamento local') }}</span><div class="preferences"><label class="preference-control"><Languages :size="15" /><span class="sr-only">{{ t('Idioma') }}</span><select v-model="language" :aria-label="t('Idioma')"><option value="auto">{{ t('Automático') }}</option><option value="pt-BR">Português (BR)</option><option value="en">English</option></select><ChevronDown :size="12" /></label><label class="preference-control"><SunMoon :size="15" /><span class="sr-only">{{ t('Aparência') }}</span><select v-model="theme" :aria-label="t('Aparência')"><option value="system">{{ t('Sistema') }}</option><option value="light">{{ t('Claro') }}</option><option value="dark">{{ t('Escuro') }}</option></select><ChevronDown :size="12" /></label><label class="preference-control"><Rows3 :size="15" /><span class="sr-only">{{ t('Densidade da interface') }}</span><select v-model="density" :aria-label="t('Densidade da interface')"><option value="comfortable">{{ t('Confortável') }}</option><option value="compact">{{ t('Compacto') }}</option></select><ChevronDown :size="12" /></label></div><Tutorial :t="t" @modal="tutorialDialog = $event" @notice="notify" /></div></header>
      <div class="page-content">
        <section class="page-heading"><div><p class="eyebrow">{{ t('ORGANIZE AGORA. CONTINUE DEPOIS.') }}</p><h1>{{ t('Espaço para o que importa') }}<span>.</span></h1><p class="subtitle">{{ t('Guarde suas abas, libere seu navegador e retome de onde parou.') }}</p></div><div class="heading-actions"><div class="heading-buttons"><button class="button quick-save-button" :disabled="busy || loading || !openTabs.length" :title="t('Salvar todas as abas desta janela em uma nova coleção. A confirmação aparece antes de fechar.')" @click="quickSaveTabs"><Zap :size="17" />{{ t('Salvar abas') }}</button><button class="button primary" @click="startEdit()"><Plus :size="18" /> {{ t('Nova coleção') }}</button></div><button ref="shortcutTrigger" class="text-button shortcuts-link" @click="openShortcutHelp"><Keyboard :size="14" />{{ t('Atalhos') }}<kbd v-if="shortcutBindings['quick-save-tabs']">{{ shortcutBindings['quick-save-tabs'] }}</kbd></button></div></section>
        <div v-if="restoreProgress" class="undo-banner restore-progress" role="status"><span>{{ t('Abrindo abas: {count} de {total}. Em lotes de 5.', { count: restoreProgress.attempted, total: restoreProgress.total }) }}</span><button class="text-button" :disabled="cancelRestore" @click="cancelRestore = true">{{ t('Interromper abertura') }}</button></div><div v-if="error" class="error-banner" role="alert"><span>{{ error }}</span><button class="icon-button" :aria-label="t('Dispensar erro')" @click="error = ''"><X :size="18" /></button></div>
        <div v-if="collections.some(c => c.unreadableTabs)" class="preview-note" role="status">{{ t('Algumas abas antigas não puderam ser exibidas. Os dados originais foram preservados.') }}</div>
        <div v-if="!extension" class="preview-note">{{ t('Prévia da interface · Abra a extensão no Chrome para gerenciar as abas do navegador.') }}</div>
        <section class="overview" :aria-label="t('Resumo')"><div><span class="stat-icon mint"><Layers :size="21" /></span><div><strong>{{ totalTabs }}</strong><span>{{ t('abas guardadas') }}</span></div></div><div><span class="stat-icon lavender"><Folder :size="21" /></span><div><strong>{{ collections.length }}</strong><span>{{ t('coleções criadas') }}</span></div></div><div><span class="stat-icon sand"><LayoutGrid :size="21" /></span><div><strong>{{ openTabs.length }}</strong><span>{{ t('abas abertas agora') }}</span></div></div><p><Leaf :size="19" /><span>{{ t('Um navegador mais leve.') }}<br><strong>{{ t('Uma mente mais livre.') }}</strong></span></p></section>
        <BackupTools :revision="[collections, language, theme, density]" :t="t" :locale="locale" :flush-preferences="flushPreferences" @restored="backupRestored" @notice="notify" @modal="backupDialog = $event" />
        <div class="recovery-tools"><LocalRecovery :t="t" :locale="locale" @modal="recoveryDialog = $event" @notice="notify" @restored="loadCollections($event.collections); loadTrash($event.trash); selected = 'all'; query = ''" /></div><div class="content-layout" :class="{ 'trash-layout': selected === 'trash' }">
          <section class="collections-section">
            <div v-if="selected === 'trash'" class="filter-bar"><button class="text-button" @click="selected = 'all'">{{ t('Todas as coleções') }}</button></div><TrashPanel v-if="selected === 'trash'" :entries="trash" :t="t" :locale="locale" :busy="busy || !trashAvailable" @restore="restoreTrashItem" @remove="permanentlyDelete" @empty="permanentlyDelete()" /><template v-else><div v-if="trash.length" class="undo-banner"><span>{{ t('Há itens na lixeira.') }}</span><button class="text-button" @click="selected = 'trash'">{{ t('Ver lixeira') }}</button></div><div class="section-heading"><h2>{{ heading }} <span>{{ visible.length }}</span></h2><label class="sort-label"><span class="sr-only">{{ t('Ordenar coleções') }}</span><select v-model="sort"><option value="newest">{{ t('Mais recentes') }}</option><option value="oldest">{{ t('Mais antigas') }}</option><option value="name">{{ t('Nome A–Z') }}</option></select><ChevronDown :size="14" /></label></div>
            <div class="filter-bar"><button class="text-button" @click="selected = 'trash'"><Trash2 :size="14" />{{ t('Lixeira') }} ({{ trash.length }})</button><button class="text-button" @click="selected = selected === 'favorites' ? 'all' : 'favorites'"><Star :size="14" />{{ selected === 'favorites' ? t('Todas as coleções') : t('Favoritos') }}</button></div><label class="search-field"><Search :size="18" /><input v-model="query" :placeholder="t('Buscar coleções ou abas…')" :aria-label="t('Buscar coleções ou abas')" /><button v-if="query" class="icon-button" :aria-label="t('Limpar busca')" @click="query = ''"><X :size="16" /></button></label>
            <div v-if="loading" class="empty-state" role="status">{{ t('Carregando suas coleções…') }}</div>
            <div v-else-if="!query.trim() && !visible.length" class="empty-state"><span class="empty-icon"><component :is="query ? Search : Layers" :size="30" /></span><h3>{{ query ? t('Nenhum resultado por aqui') : t('Suas próximas ideias moram aqui') }}</h3><p>{{ query ? t('Tente outro nome, site ou palavra-chave.') : t('Salve as abas abertas ou crie uma coleção para começar a organizar seu espaço.') }}</p><button class="button" @click="query ? query = '' : startEdit()"><Plus v-if="!query" :size="17" />{{ query ? t('Limpar busca') : t('Criar primeira coleção') }}</button></div>
            <section v-if="query.trim()" class="global-search-results" :aria-label="t('Resultados em todas as coleções')"><h3>{{ t('Resultados em todas as coleções') }} ({{ searchResults.length }})</h3><p v-if="!searchResults.length">{{ t('Nenhum resultado por aqui') }}</p><div v-for="result in searchResults.slice(0, searchLimit)" :key="result.collection.key! + '-' + result.index" class="search-result"><a :href="result.tab.url" @click.prevent="openTab(result.tab.url)"><SiteIcon :url="result.tab.url" /><span><strong>{{ result.tab.title }}</strong><small>{{ result.tab.url }}</small></span><ArrowUpRight :size="15" /></a><button class="text-button" @click="revealResult(result.collection)"><Folder :size="13" />{{ result.collection.name }}</button></div><button v-if="searchResults.length > searchLimit" class="button" @click="searchLimit += 50">{{ t('Mostrar mais resultados') }}</button></section><article v-for="(collection, index) in query.trim() ? [] : visible" :key="collection.key" class="collection-card" :class="{ 'drop-target': dragged && dragged.source !== collection.key && !collection.unreadableTabs, 'drop-over': dropOver === collection.key }" @dragover="allowDrop(collection, $event)" @dragleave.self="dropOver = ''" @drop.prevent="dropTab(collection)">
              <div class="card-top"><span class="folder-tile" :class="['mint','lavender','sand'][index % 3]"><Folder :size="22" /></span><div class="card-title"><h3>{{ collection.name }}</h3><p><Clock3 :size="12" />{{ dateLabel(collection.date) }}<span>·</span>{{ collection.tabs.length }} {{ collection.tabs.length === 1 ? t('aba') : t('abas') }}</p></div><button class="text-button card-collapse" :aria-expanded="expanded.includes(collection.key!)" @click="toggle(collection.key!)">{{ expanded.includes(collection.key!) ? t('Ocultar abas') : t('Ver abas') }}<ChevronDown :size="14" :class="{ rotated: expanded.includes(collection.key!) }" /></button><button class="icon-button pin-button" :class="{ starred: collection.pinned }" :aria-label="collection.pinned ? t('Desafixar coleção') : t('Fixar coleção no topo')" :aria-pressed="!!collection.pinned" :disabled="busy" @click="pin(collection)"><Pin :size="16" :fill="collection.pinned ? 'currentColor' : 'none'" /></button><button class="icon-button favorite-button" :class="{ starred: collection.favorite }" :aria-label="collection.favorite ? t('Remover dos favoritos') : t('Adicionar aos favoritos')" :aria-pressed="!!collection.favorite" :disabled="busy" @click="favorite(collection)"><Star :size="16" :fill="collection.favorite ? 'currentColor' : 'none'" /></button><button class="icon-button" :aria-label="t('Editar coleção')" @click="startEdit(collection)"><Pencil :size="16" /></button><button class="icon-button delete-button" :aria-label="t('Excluir coleção')" @click="remove(collection)"><Trash2 :size="16" /></button></div>
              <p v-if="collection.notes" class="collection-notes">{{ collection.notes }}</p><details v-if="collection.unreadableTabs" class="legacy-note"><summary>{{ t('Dados antigos: algumas abas não puderam ser lidas') }}</summary><p>{{ t('Apenas as abas reconhecidas são exibidas. O conteúdo original continua salvo; a edição de abas desta coleção está bloqueada para evitar perda de dados.') }}</p><p>{{ t('Use Exportar backup para guardar uma cópia completa antes de corrigir o formato ou pedir ajuda.') }}</p><button class="text-button" @click="copyOriginal(collection)">{{ t('Copiar dados originais') }}</button><pre tabindex="0" :aria-label="t('Dados originais')">{{ JSON.stringify(collection.source, null, 2) }}</pre></details><div v-if="collection.tags?.length" class="tag-list"><button v-for="tag in collection.tags" :key="tag" class="tag-chip" @click="query = tag">#{{ tag }}</button></div><div class="tab-preview" v-if="collection.tabs.length"><span v-for="tab in collection.tabs.slice(0, 3)" :key="tab.url" class="domain-chip"><SiteIcon :url="tab.url" compact />{{ domain(tab.url) }}</span><span v-if="collection.tabs.length > 3" class="extra-tabs">+{{ collection.tabs.length - 3 }}</span></div>
              <p v-else class="empty-collection">{{ t('Esta coleção ainda não tem abas.') }}</p>
              <div v-if="expanded.includes(collection.key!)" class="saved-tab-list"><div class="saved-selection-toolbar"><span>{{ t('Selecionadas: {count}', { count: selectedSaved(collection).length }) }}</span><button class="text-button" :disabled="busy" @click="selectAllSaved(collection)">{{ selectedSaved(collection).length === collection.tabs.length ? t('Desmarcar todas') : t('Selecionar todas') }}</button><button class="button" :disabled="busy || !selectedSaved(collection).length" @click="restore(collection, selectedSaved(collection))">{{ t('Abrir selecionadas') }}<ArrowUpRight :size="14" /></button></div><p class="drag-hint">{{ t('Arraste pela alça para outra coleção ou use Mover para.') }}</p><div v-for="(tab, tabIndex) in collection.tabs" :key="tabIndex" class="saved-tab"><input type="checkbox" :checked="(savedSelection[collection.key!] || []).includes(tabIndex)" :disabled="busy" :aria-label="t('Selecionar {title}', { title: tab.title })" @change="selectSaved(collection, tabIndex)" /><button class="icon-button drag-handle" type="button" :draggable="!busy && !collection.unreadableTabs" :disabled="busy || collection.unreadableTabs" :aria-label="t('Arrastar {title}', { title: tab.title })" @dragstart="beginDrag(collection, tabIndex, $event)" @dragend="endDrag"><GripVertical :size="16" /></button><a class="saved-tab-link" :href="tab.url" @click.prevent="openTab(tab.url)"><SiteIcon :url="tab.url" /><span class="saved-tab-info"><strong>{{ tab.title }}</strong><small>{{ domain(tab.url) }}</small><span v-if="tab.group" class="group-chip" :data-color="tab.group.color">{{ tab.group.title || t('Grupo sem nome') }}</span></span><ArrowUpRight :size="16" /></a><select class="move-select" :aria-label="t('Mover {title}', { title: tab.title })" :disabled="busy || collection.unreadableTabs" value="" @change="moveTab(collection, tabIndex, $event)"><option value="">{{ t('Mover para…') }}</option><option v-for="target in collections.filter(c => c.key !== collection.key && !c.unreadableTabs)" :key="target.key" :value="target.key">{{ target.name }}</option></select><button class="icon-button delete-button" :aria-label="t('Remover {title}', { title: tab.title })" :disabled="busy || collection.unreadableTabs" @click="deleteSavedTab(collection, tabIndex)"><X :size="15" /></button></div><form v-if="!collection.unreadableTabs" class="add-tab-form" @submit.prevent="addTab(collection, $event)"><input name="title" :placeholder="t('Título (opcional)')" :aria-label="t('Título (opcional)')" maxlength="500" /><input name="url" type="url" placeholder="https://…" :aria-label="t('Endereço da aba')" required /><button class="button" :disabled="busy"><Plus :size="15" />{{ t('Adicionar aba') }}</button></form></div>
              <div class="card-footer"><button class="text-button" :aria-expanded="expanded.includes(collection.key!)" @click="toggle(collection.key!)">{{ expanded.includes(collection.key!) ? t('Ocultar abas') : t('Ver abas') }}<ChevronDown :size="15" :class="{ rotated: expanded.includes(collection.key!) }" /></button><button class="restore-button" :disabled="busy || !collection.tabs.length" @click="restore(collection)">{{ t('Abrir coleção') }}<ArrowUpRight :size="15" /></button></div>
            </article>
            <p v-if="visible.length" class="collection-end">{{ t('Tudo no seu lugar. No seu tempo.') }}</p></template>
          </section>
          <aside v-if="selected !== 'trash'" class="open-panel"><div class="open-panel-heading"><span class="live-dot"></span><h2>{{ t('Abas abertas') }}</h2><span class="count-pill">{{ openTabs.length }}</span></div><p class="panel-description">{{ t('Sua janela atual, pronta para guardar.') }}</p><div v-if="openTabs.length" class="selection-toolbar"><span>{{ t('Selecionadas: {count}', { count: selectedTabs.length }) }}</span><button class="text-button" @click="excludedTabs = selectedTabs.length === openTabs.length ? openTabs.map(tab => tab.id!) : []">{{ selectedTabs.length === openTabs.length ? t('Desmarcar todas') : t('Selecionar todas') }}</button></div><div class="open-tab-list"><div v-for="tab in openTabs" :key="tab.id" class="open-tab"><input type="checkbox" :checked="!excludedTabs.includes(tab.id!)" :aria-label="t('Selecionar {title}', { title: tab.title })" @change="selectTab(tab)" /><SiteIcon :url="tab.url" /><button class="tab-name" @click="openTab(tab.url)"><strong>{{ tab.title }}</strong><small>{{ domain(tab.url) }}</small></button><button class="icon-button close-tab" :aria-label="t('Fechar aba {title}', { title: tab.title })" @click="closeTab(tab)"><X :size="15" /></button></div><div v-if="!openTabs.length" class="open-empty"><Check :size="24" /><strong>{{ t('Tudo tranquilo por aqui') }}</strong><p>{{ t('As abas desta janela aparecerão aqui.') }}</p></div></div><div class="save-area"><label class="field-label" for="save-destination">{{ t('Salvar em') }}</label><CollectionPicker id="save-destination" v-model="saveDestination" :collections="collections" :t="t" :label="t('Salvar em')" allow-new :disabled="busy" /><label class="option-check"><input v-model="ignoreDuplicates" type="checkbox" :disabled="busy" />{{ t('Ignorar abas duplicadas') }}</label><p v-if="duplicateCount" class="duplicate-hint">{{ t('Duplicadas: {count}', { count: duplicateCount }) }}</p><label class="option-check"><input v-model="closeAfterSave" type="checkbox" :disabled="busy" />{{ t('Fechar abas após salvar') }}</label><button class="button primary" :disabled="!selectedTabs.length || busy" @click="saveTabs()"><ArrowDownToLine :size="18" />{{ busy ? t('Salvando…') : t(selectedTabs.length === 1 ? 'Salvar {count} aba' : 'Salvar {count} abas', { count: selectedTabs.length }) }}</button><p>{{ closeAfterSave ? t('As abas selecionadas serão salvas e fechadas.') : t('As abas selecionadas continuarão abertas.') }}<br>{{ t('Esta página continua aberta.') }}</p></div><div class="tip"><Leaf :size="18" /><p><strong>{{ t('Respire. Suas abas estão guardadas.') }}</strong><br>{{ t('Reabra uma coleção quando precisar.') }}</p></div></aside>
        </div>
        <footer class="page-footer"><span>{{ t('Desenvolvido por') }} <a href="https://rogerarruda.dev" target="_blank" rel="noopener noreferrer">rogerarruda.dev</a></span><span>TabSaver <span class="footer-dot">●</span> {{ t('Seu espaço de volta.') }}</span></footer>
      </div>
    </main>
    <div v-if="shortcutDialog" class="modal-backdrop" @click.self="closeShortcutHelp" @keydown.esc="closeShortcutHelp"><section class="modal shortcuts-modal" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title" @keydown.tab="trapFocus"><div class="modal-heading"><span class="folder-tile mint"><Keyboard :size="23" /></span><button v-focus class="icon-button" :aria-label="t('Fechar')" @click="closeShortcutHelp"><X :size="20" /></button></div><h2 id="shortcuts-title">{{ t('Atalhos do teclado') }}</h2><p>{{ t('Os atalhos funcionam com o Chrome em foco. Você pode alterá-los nas configurações de extensões.') }}</p><dl class="shortcut-list"><div><dt>{{ t('Abrir TabSaver') }}</dt><dd><kbd>{{ shortcutBindings['_execute_action'] || t('Não atribuído') }}</kbd></dd></div><div><dt>{{ t('Salvar abas rapidamente') }}</dt><dd><kbd>{{ shortcutBindings['quick-save-tabs'] || t('Não atribuído') }}</kbd></dd></div></dl><p>{{ t('O salvamento rápido usa todas as abas da janela, ignora duplicatas e cria uma nova coleção. Nenhuma aba é fechada antes da confirmação.') }}</p><div class="modal-actions"><button class="button" @click="closeShortcutHelp">{{ t('Fechar') }}</button><button class="button primary" @click="configureShortcuts">{{ t('Configurar no Chrome') }}</button></div></section></div><ConfirmDialog v-if="confirmation" :options="confirmation" :return-focus="confirmationTarget" :cancel-label="t('Cancelar')" @result="settleConfirmation" /><div v-if="message" class="toast" role="status"><Check :size="18" />{{ message }}</div>
    <div v-if="dialog" class="modal-backdrop" @click.self="dialog = false" @keydown.esc="dialog = false"><form class="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title" @submit.prevent="submitCollection" @keydown.tab="trapFocus"><div class="modal-heading"><span class="folder-tile mint"><Folder :size="23" /></span><button type="button" class="icon-button" :aria-label="t('Fechar')" @click="dialog = false"><X :size="20" /></button></div><h2 id="dialog-title">{{ editing ? t('Editar coleção') : t('Um novo espaço para suas abas') }}</h2><p>{{ t('Escolha um nome que ajude você a encontrar suas ideias.') }}</p><label for="collection-name">{{ t('Nome da coleção') }}</label><input id="collection-name" v-model="name" v-focus maxlength="100" :placeholder="t('Ex.: Leituras para depois')" required /><label for="collection-tags" class="tags-label">{{ t('Etiquetas (separadas por vírgula)') }}</label><input id="collection-tags" v-model="tags" maxlength="600" :placeholder="t('Ex.: trabalho, pesquisa')" /><label for="collection-notes" class="tags-label">{{ t('Notas') }}</label><textarea id="collection-notes" v-model="notes" maxlength="5000" rows="4" :placeholder="t('O que você quer lembrar ao retomar?')" /><div class="modal-actions"><button type="button" class="button" @click="dialog = false">{{ t('Cancelar') }}</button><button class="button primary" :disabled="!name.trim() || busy">{{ editing ? t('Salvar alterações') : t('Criar coleção') }}</button></div></form></div>
  </div>
</template>

<script lang="ts">
export default { directives: { focus: { mounted(el: HTMLInputElement) { el.focus() } } } }
</script>
