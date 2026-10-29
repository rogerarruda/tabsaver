<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { Layers, LayoutGrid, Search, Plus, ArrowUpRight, X, Leaf, Folder, ChevronDown, ArrowDownToLine, Pencil, Trash2, Check, HardDrive, Clock3, Languages, SunMoon } from 'lucide-vue-next'

import BackupTools from './BackupTools.vue'
import Tutorial from './Tutorial.vue'
import brandIcon from '../images/tabsaver-icon.svg'
import type { Snapshot } from './backup'
import { usePreferences } from './preferences'

import { readCollections, writeCollections, appendTabs } from './collections'
import type { Tab, Collection } from './collections'
const openTabs = ref<Tab[]>([])
const saveDestination = ref('new')
const excludedTabs = ref<number[]>([])
const closeAfterSave = ref(true)
const selectedTabs = computed(() => openTabs.value.filter(tab => !excludedTabs.value.includes(tab.id!)))
function selectTab(tab: Tab) { const id = tab.id!; excludedTabs.value = excludedTabs.value.includes(id) ? excludedTabs.value.filter(value => value !== id) : [...excludedTabs.value, id] }
const collections = ref<Collection[]>([])
const query = ref('')
const sort = ref('newest')
const selected = ref('all')
const expanded = ref<string[]>([])
const dialog = ref(false)
const backupDialog = ref(false)
const tutorialDialog = ref(false)
const editing = ref<Collection | null>(null)
const name = ref('')
const busy = ref(false)
const loading = ref(true)
const message = ref('')
const error = ref('')
const storageUnavailable = ref(false)
const { language, theme, locale, t, loadPreferences, applyPreferences, flushPreferences } = usePreferences(text => error.value = text)
let noticeTimer: ReturnType<typeof setTimeout>
const extension = typeof chrome !== 'undefined' && !!chrome.storage?.local && !!chrome.tabs
const totalTabs = computed(() => collections.value.reduce((sum, c) => sum + c.tabs.length, 0))
const visible = computed(() => collections.value.filter(c => (selected.value === 'all' || c.key === selected.value) && `${c.name} ${c.tabs.map(t => `${t.title} ${t.url}`).join(' ')}`.toLocaleLowerCase().includes(query.value.toLocaleLowerCase())).sort((a, b) => sort.value === 'name' ? a.name.localeCompare(b.name, locale.value) : (sort.value === 'oldest' ? 1 : -1) * (new Date(a.date).getTime() - new Date(b.date).getTime())))
const heading = computed(() => selected.value === 'all' ? t('Suas coleções') : collections.value.find(c => c.key === selected.value)?.name || t('Suas coleções'))
function notify(text: string) { message.value = text; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => message.value = '', 4500) }
function domain(url: string) { try { return new URL(url).hostname.replace(/^www\./, '') || t('Página do navegador') } catch { return t('Página do navegador') } }
function dateLabel(date: string) { if (!Number.isFinite(new Date(date).getTime())) return '—'; return new Date(date).toLocaleDateString(locale.value, { day: 'numeric', month: 'short', year: 'numeric' }) }
async function refreshTabs() {
  if (!extension) return
  try { const tabs = await chrome.tabs.query({ currentWindow: true }); openTabs.value = tabs.filter(t => t.url && !t.url.startsWith('chrome-extension://') && !t.url.startsWith('chrome://newtab')).map(t => ({ id: t.id, title: t.title || t.url!, url: t.url! })) } catch { error.value = t('Não foi possível carregar as abas. Recarregue esta página.') }
}
async function persist(next: Collection[]) {
  if (storageUnavailable.value) throw new Error('Storage could not be read safely')
  const stored = writeCollections(next)
  if (extension) await chrome.storage.local.set({ collections: stored })
  else localStorage.setItem('tabsaver-preview', JSON.stringify(stored))
  collections.value = readCollections(stored)
  selected.value = 'all'
  expanded.value = []
}
function trapFocus(event: KeyboardEvent) {
  const items = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('button:not(:disabled), input, [href], select')]
  const first = items[0], last = items[items.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
function startEdit(collection: Collection | null = null) { editing.value = collection; name.value = collection?.name || ''; dialog.value = true }
async function submitCollection() {
  if (!name.value.trim() || busy.value) return
  busy.value = true
  try {
    if (editing.value && (editing.value.source === null || typeof editing.value.source !== 'object')) throw new Error('Invalid legacy collection')
    const next = editing.value ? collections.value.map(c => c.key === editing.value!.key ? { ...c, name: name.value.trim(), renamed: true } : c) : [...collections.value, { name: name.value.trim(), tabs: [], date: new Date().toISOString() }]
    await persist(next); dialog.value = false; notify(editing.value ? t('Coleção renomeada.') : t('Coleção criada.'))
  } catch { error.value = t('Não foi possível salvar a coleção. Tente novamente.') } finally { busy.value = false }
}
async function saveTabs() {
  if (!selectedTabs.value.length || busy.value) return
  busy.value = true; error.value = ''
  try {
    const snapshot = [...selectedTabs.value]
    const date = new Date()
    const destination = collections.value.find(c => c.key === saveDestination.value)
    if (saveDestination.value !== 'new' && !destination) throw new Error('Missing collection')
    await persist(destination ? collections.value.map(c => c.key === destination.key ? appendTabs(c, snapshot) : c) : [...collections.value, { name: t('Sessão de {date} · {time}', { date: date.toLocaleDateString(locale.value, { day: 'numeric', month: 'short' }), time: date.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' }) }), tabs: snapshot.map(({ title, url }) => ({ title, url })), date: date.toISOString() }])
    saveDestination.value = 'new'
    if (extension && closeAfterSave.value) { const current = await chrome.tabs.getCurrent(); const ids = snapshot.filter(t => t.id !== current?.id && t.id !== undefined).map(t => t.id!); if (ids.length) await chrome.tabs.remove(ids); await refreshTabs() }
    selected.value = 'all'; notify(t('Abas salvas. Tudo organizado!'))
  } catch { error.value = t('Não foi possível concluir. Confira a coleção salva antes de tentar novamente.') } finally { busy.value = false }
}
async function openTab(url: string) { try { if (extension) await chrome.tabs.create({ url }); else window.open(url, '_blank', 'noopener,noreferrer') } catch { error.value = t('Não foi possível abrir esta aba.') } }
async function restore(collection: Collection) { for (const tab of collection.tabs) await openTab(tab.url); notify(t('{count} abas abertas.', { count: collection.tabs.length })) }
async function closeTab(tab: Tab) { try { if (extension && tab.id !== undefined) { await chrome.tabs.remove(tab.id); await refreshTabs() } } catch { error.value = t('Não foi possível fechar esta aba.') } }
async function remove(collection: Collection) {
  if (!window.confirm(t('Excluir a coleção “{name}” com {count} abas?', { name: collection.name, count: collection.tabs.length }))) return
  try { await persist(collections.value.filter(c => c.key !== collection.key)); if (selected.value === collection.key) selected.value = 'all'; notify(t('Coleção excluída.')) } catch { error.value = t('Não foi possível excluir a coleção.') }
}
function toggle(date: string) { expanded.value = expanded.value.includes(date) ? expanded.value.filter(d => d !== date) : [...expanded.value, date] }
function loadCollections(value: unknown) {
  try { collections.value = readCollections(value); storageUnavailable.value = false }
  catch { storageUnavailable.value = true; error.value = t('Não foi possível carregar suas coleções. Recarregue para tentar novamente.') }
}
function backupRestored(snapshot: Snapshot) { loadCollections(snapshot.collections); applyPreferences(snapshot.preferences); selected.value = 'all'; expanded.value = []; query.value = ''; error.value = '' }
function storageChanged(changes: { [key: string]: chrome.storage.StorageChange }, area: string) { if (area === 'local' && changes.collections) loadCollections(changes.collections.newValue ?? []) }
onMounted(async () => {
  await loadPreferences()
  try {
    if (extension) { const data = await chrome.storage.local.get({ collections: [] }); loadCollections(data.collections); await refreshTabs(); chrome.tabs.onCreated.addListener(refreshTabs); chrome.tabs.onRemoved.addListener(refreshTabs); chrome.tabs.onUpdated.addListener(refreshTabs); chrome.storage.onChanged.addListener(storageChanged) }
    else loadCollections(JSON.parse(localStorage.getItem('tabsaver-preview') || '[]'))
  } catch { storageUnavailable.value = true; error.value = t('Não foi possível carregar suas coleções. Recarregue para tentar novamente.') } finally { loading.value = false }
})
onBeforeUnmount(() => { clearTimeout(noticeTimer); if (extension) { chrome.tabs.onCreated.removeListener(refreshTabs); chrome.tabs.onRemoved.removeListener(refreshTabs); chrome.tabs.onUpdated.removeListener(refreshTabs); chrome.storage.onChanged.removeListener(storageChanged) } })
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar" :inert="dialog || backupDialog || tutorialDialog || undefined">
      <a class="brand" href="#" @click.prevent="selected = 'all'"><img class="brand-logo" :src="brandIcon" alt="" width="37" height="37" />TabSaver<span class="brand-dot">.</span></a>
      <div class="workspace-label">{{ t('SEU ESPAÇO') }}</div>
      <button class="nav-item" :class="{ active: selected === 'all' }" @click="selected = 'all'"><LayoutGrid :size="18" /> {{ t('Todas as coleções') }} <span class="nav-count">{{ collections.length }}</span></button>
      <div class="sidebar-section"><span>{{ t('COLEÇÕES') }}</span><button class="icon-button" :aria-label="t('Criar coleção')" @click="startEdit()"><Plus :size="17" /></button></div>
      <nav class="collection-nav" :aria-label="t('Coleções')">
        <button v-for="collection in [...collections].sort((a,b) => b.date.localeCompare(a.date))" :key="collection.key" class="nav-item" :class="{ active: selected === collection.key }" @click="selected = collection.key!"><Folder :size="17" /><span class="nav-name">{{ collection.name }}</span><span class="nav-count">{{ collection.tabs.length }}</span></button>
        <p v-if="!collections.length" class="sidebar-empty">{{ t('Um lugar para cada ideia.') }}<br>{{ t('Crie sua primeira coleção.') }}</p>
      </nav>
      <div class="local-note"><span class="local-icon"><HardDrive :size="18" /></span><div><strong>{{ t('Salvo neste navegador') }}</strong><p>{{ t('Suas abas ficam no seu dispositivo.') }}</p></div><span class="status-dot"></span></div>
      <div class="sidebar-footer"><span>{{ t('Menos abas. Mais espaço.') }}</span><Leaf :size="15" /></div>
    </aside>

    <main :inert="dialog || backupDialog || tutorialDialog || undefined">
      <header class="topbar"><span class="breadcrumb">{{ t('Meu espaço') }} <span>/</span> <strong>{{ t('Coleções') }}</strong></span><div class="topbar-controls"><span class="local-badge"><span class="status-dot"></span> {{ t('Armazenamento local') }}</span><div class="preferences"><label class="preference-control"><Languages :size="15" /><span class="sr-only">{{ t('Idioma') }}</span><select v-model="language" :aria-label="t('Idioma')"><option value="auto">{{ t('Automático') }}</option><option value="pt-BR">Português (BR)</option><option value="en">English</option></select><ChevronDown :size="12" /></label><label class="preference-control"><SunMoon :size="15" /><span class="sr-only">{{ t('Aparência') }}</span><select v-model="theme" :aria-label="t('Aparência')"><option value="system">{{ t('Sistema') }}</option><option value="light">{{ t('Claro') }}</option><option value="dark">{{ t('Escuro') }}</option></select><ChevronDown :size="12" /></label></div><Tutorial :t="t" @modal="tutorialDialog = $event" @notice="notify" /></div></header>
      <div class="page-content">
        <section class="page-heading"><div><p class="eyebrow">{{ t('ORGANIZE AGORA. CONTINUE DEPOIS.') }}</p><h1>{{ t('Espaço para o que importa') }}<span>.</span></h1><p class="subtitle">{{ t('Guarde suas abas, libere seu navegador e retome de onde parou.') }}</p></div><button class="button primary" @click="startEdit()"><Plus :size="18" /> {{ t('Nova coleção') }}</button></section>
        <div v-if="error" class="error-banner" role="alert"><span>{{ error }}</span><button class="icon-button" :aria-label="t('Dispensar erro')" @click="error = ''"><X :size="18" /></button></div>
        <div v-if="collections.some(c => c.unreadableTabs)" class="preview-note" role="status">{{ t('Algumas abas antigas não puderam ser exibidas. Os dados originais foram preservados.') }}</div>
        <div v-if="!extension" class="preview-note">{{ t('Prévia da interface · Abra a extensão no Chrome para gerenciar as abas do navegador.') }}</div>
        <section class="overview" :aria-label="t('Resumo')"><div><span class="stat-icon mint"><Layers :size="21" /></span><div><strong>{{ totalTabs }}</strong><span>{{ t('abas guardadas') }}</span></div></div><div><span class="stat-icon lavender"><Folder :size="21" /></span><div><strong>{{ collections.length }}</strong><span>{{ t('coleções criadas') }}</span></div></div><div><span class="stat-icon sand"><LayoutGrid :size="21" /></span><div><strong>{{ openTabs.length }}</strong><span>{{ t('abas abertas agora') }}</span></div></div><p><Leaf :size="19" /><span>{{ t('Um navegador mais leve.') }}<br><strong>{{ t('Uma mente mais livre.') }}</strong></span></p></section>
        <BackupTools :t="t" :locale="locale" :flush-preferences="flushPreferences" @restored="backupRestored" @notice="notify" @modal="backupDialog = $event" />
        <div class="content-layout">
          <section class="collections-section">
            <div class="section-heading"><h2>{{ heading }} <span>{{ visible.length }}</span></h2><label class="sort-label"><span class="sr-only">{{ t('Ordenar coleções') }}</span><select v-model="sort"><option value="newest">{{ t('Mais recentes') }}</option><option value="oldest">{{ t('Mais antigas') }}</option><option value="name">{{ t('Nome A–Z') }}</option></select><ChevronDown :size="14" /></label></div>
            <label class="search-field"><Search :size="18" /><input v-model="query" :placeholder="t('Buscar coleções ou abas…')" :aria-label="t('Buscar coleções ou abas')" /><button v-if="query" class="icon-button" :aria-label="t('Limpar busca')" @click="query = ''"><X :size="16" /></button></label>
            <div v-if="loading" class="empty-state" role="status">{{ t('Carregando suas coleções…') }}</div>
            <div v-else-if="!visible.length" class="empty-state"><span class="empty-icon"><component :is="query ? Search : Layers" :size="30" /></span><h3>{{ query ? t('Nenhum resultado por aqui') : t('Suas próximas ideias moram aqui') }}</h3><p>{{ query ? t('Tente outro nome, site ou palavra-chave.') : t('Salve as abas abertas ou crie uma coleção para começar a organizar seu espaço.') }}</p><button class="button" @click="query ? query = '' : startEdit()"><Plus v-if="!query" :size="17" />{{ query ? t('Limpar busca') : t('Criar primeira coleção') }}</button></div>
            <article v-for="(collection, index) in visible" :key="collection.key" class="collection-card">
              <div class="card-top"><span class="folder-tile" :class="['mint','lavender','sand'][index % 3]"><Folder :size="22" /></span><div class="card-title"><h3>{{ collection.name }}</h3><p><Clock3 :size="12" />{{ dateLabel(collection.date) }}<span>·</span>{{ collection.tabs.length }} {{ collection.tabs.length === 1 ? t('aba') : t('abas') }}</p></div><button class="icon-button" :aria-label="t('Renomear coleção')" @click="startEdit(collection)"><Pencil :size="16" /></button><button class="icon-button delete-button" :aria-label="t('Excluir coleção')" @click="remove(collection)"><Trash2 :size="16" /></button></div>
              <div class="tab-preview" v-if="collection.tabs.length"><span v-for="tab in collection.tabs.slice(0, 3)" :key="tab.url" class="domain-chip"><span>{{ domain(tab.url).charAt(0).toUpperCase() }}</span>{{ domain(tab.url) }}</span><span v-if="collection.tabs.length > 3" class="extra-tabs">+{{ collection.tabs.length - 3 }}</span></div>
              <p v-else class="empty-collection">{{ t('Esta coleção ainda não tem abas.') }}</p>
              <div v-if="expanded.includes(collection.key!)" class="saved-tab-list"><a v-for="(tab, tabIndex) in collection.tabs" :key="tabIndex" :href="tab.url" @click.prevent="openTab(tab.url)" class="saved-tab"><span class="site-letter">{{ domain(tab.url).charAt(0).toUpperCase() }}</span><span><strong>{{ tab.title }}</strong><small>{{ domain(tab.url) }}</small></span><ArrowUpRight :size="16" /></a></div>
              <div class="card-footer"><button class="text-button" :disabled="!collection.tabs.length" :aria-expanded="expanded.includes(collection.key!)" @click="toggle(collection.key!)">{{ expanded.includes(collection.key!) ? t('Ocultar abas') : t('Ver abas') }}<ChevronDown :size="15" :class="{ rotated: expanded.includes(collection.key!) }" /></button><button class="restore-button" :disabled="!collection.tabs.length" @click="restore(collection)">{{ t('Abrir coleção') }}<ArrowUpRight :size="15" /></button></div>
            </article>
            <p v-if="visible.length" class="collection-end">{{ t('Tudo no seu lugar. No seu tempo.') }}</p>
          </section>
          <aside class="open-panel"><div class="open-panel-heading"><span class="live-dot"></span><h2>{{ t('Abas abertas') }}</h2><span class="count-pill">{{ openTabs.length }}</span></div><p class="panel-description">{{ t('Sua janela atual, pronta para guardar.') }}</p><div v-if="openTabs.length" class="selection-toolbar"><span>{{ t('{count} selecionadas', { count: selectedTabs.length }) }}</span><button class="text-button" @click="excludedTabs = selectedTabs.length === openTabs.length ? openTabs.map(tab => tab.id!) : []">{{ selectedTabs.length === openTabs.length ? t('Desmarcar todas') : t('Selecionar todas') }}</button></div><div class="open-tab-list"><div v-for="tab in openTabs" :key="tab.id" class="open-tab"><input type="checkbox" :checked="!excludedTabs.includes(tab.id!)" :aria-label="t('Selecionar {title}', { title: tab.title })" @change="selectTab(tab)" /><span class="site-letter">{{ domain(tab.url).charAt(0).toUpperCase() }}</span><button class="tab-name" @click="openTab(tab.url)"><strong>{{ tab.title }}</strong><small>{{ domain(tab.url) }}</small></button><button class="icon-button close-tab" :aria-label="t('Fechar aba {title}', { title: tab.title })" @click="closeTab(tab)"><X :size="15" /></button></div><div v-if="!openTabs.length" class="open-empty"><Check :size="24" /><strong>{{ t('Tudo tranquilo por aqui') }}</strong><p>{{ t('As abas desta janela aparecerão aqui.') }}</p></div></div><div class="save-area"><label class="field-label" for="save-destination">{{ t('Salvar em') }}</label><select id="save-destination" v-model="saveDestination" class="field-select" :disabled="busy"><option value="new">{{ t('Nova coleção') }}</option><option v-for="c in collections" :key="c.key" :value="c.key" :disabled="c.unreadableTabs">{{ c.name }}</option></select><label class="option-check"><input v-model="closeAfterSave" type="checkbox" :disabled="busy" />{{ t('Fechar abas após salvar') }}</label><button class="button primary" :disabled="!selectedTabs.length || busy" @click="saveTabs"><ArrowDownToLine :size="18" />{{ busy ? t('Salvando…') : t('Salvar {count} abas', { count: selectedTabs.length }) }}</button><p>{{ closeAfterSave ? t('As abas selecionadas serão salvas e fechadas.') : t('As abas selecionadas continuarão abertas.') }}<br>{{ t('Esta página continua aberta.') }}</p></div><div class="tip"><Leaf :size="18" /><p><strong>{{ t('Respire. Suas abas estão guardadas.') }}</strong><br>{{ t('Reabra uma coleção quando precisar.') }}</p></div></aside>
        </div>
        <footer class="page-footer"><span>{{ t('Desenvolvido por') }} <a href="https://rogerarruda.dev" target="_blank" rel="noopener noreferrer">rogerarruda.dev</a></span><span>TabSaver <span class="footer-dot">●</span> {{ t('Seu espaço de volta.') }}</span></footer>
      </div>
    </main>
    <div v-if="message" class="toast" role="status"><Check :size="18" />{{ message }}</div>
    <div v-if="dialog" class="modal-backdrop" @click.self="dialog = false" @keydown.esc="dialog = false"><form class="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title" @submit.prevent="submitCollection" @keydown.tab="trapFocus"><div class="modal-heading"><span class="folder-tile mint"><Folder :size="23" /></span><button type="button" class="icon-button" :aria-label="t('Fechar')" @click="dialog = false"><X :size="20" /></button></div><h2 id="dialog-title">{{ editing ? t('Renomear coleção') : t('Um novo espaço para suas abas') }}</h2><p>{{ t('Escolha um nome que ajude você a encontrar suas ideias.') }}</p><label for="collection-name">{{ t('Nome da coleção') }}</label><input id="collection-name" v-model="name" v-focus maxlength="100" :placeholder="t('Ex.: Leituras para depois')" required /><div class="modal-actions"><button type="button" class="button" @click="dialog = false">{{ t('Cancelar') }}</button><button class="button primary" :disabled="!name.trim() || busy">{{ editing ? t('Salvar nome') : t('Criar coleção') }}</button></div></form></div>
  </div>
</template>

<script lang="ts">
export default { directives: { focus: { mounted(el: HTMLInputElement) { el.focus() } } } }
</script>
