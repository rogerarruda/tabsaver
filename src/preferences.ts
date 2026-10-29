import { computed, onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue'
import { english } from './translations'

type Language = 'auto' | 'pt-BR' | 'en'
type Theme = 'system' | 'light' | 'dark'
type Preferences = { language: Language; theme: Theme }
const cacheKey = 'tabsaver-preferences'
const defaults: Preferences = { language: 'auto', theme: 'system' }
function normalize(value: unknown): Preferences {
  const input = value as Partial<Preferences> | null
  return {
    language: ['auto', 'pt-BR', 'en'].includes(input?.language || '') ? input!.language! : 'auto',
    theme: ['system', 'light', 'dark'].includes(input?.theme || '') ? input!.theme! : 'system',
  }
}
function cachedPreferences() {
  try { return normalize(JSON.parse(localStorage.getItem(cacheKey) || 'null')) } catch { return defaults }
}

export function usePreferences(onError: (message: string) => void) {
  const extension = typeof chrome !== 'undefined' && !!chrome.storage?.local
  const initial = cachedPreferences()
  const language = ref<Language>(initial.language)
  const theme = ref<Theme>(initial.theme)
  const browserLanguage = ref(navigator.language)
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const systemDark = ref(media.matches)
  const locale = computed(() => language.value === 'auto' ? (browserLanguage.value.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en') : language.value)
  const resolvedTheme = computed(() => theme.value === 'system' ? (systemDark.value ? 'dark' : 'light') : theme.value)
  function t(text: string, params: Record<string, string | number> = {}) {
    let translated = locale.value === 'en' ? english[text] || text : text
    for (const [key, value] of Object.entries(params)) translated = translated.replaceAll(`{${key}}`, String(value))
    return translated
  }
  watchEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme.value
    document.documentElement.lang = locale.value
    document.title = t('TabSaver · Seu espaço de volta')
  })
  let applying = false
  let pendingWrite = Promise.resolve()
  function apply(value: unknown) {
    const next = normalize(value)
    applying = true
    language.value = next.language
    theme.value = next.theme
    applying = false
    try { localStorage.setItem(cacheKey, JSON.stringify(next)) } catch { /* Chrome storage remains authoritative. */ }
  }
  watch([language, theme], () => {
    if (applying) return
    const next = { language: language.value, theme: theme.value }
    pendingWrite = pendingWrite.then(async () => {
      try {
        if (extension) await chrome.storage.local.set({ preferences: next })
        localStorage.setItem(cacheKey, JSON.stringify(next))
      } catch { onError(t('Não foi possível salvar suas preferências. Tente novamente.')) }
    })
  }, { flush: 'sync' })
  function changeTheme(event: MediaQueryListEvent) { systemDark.value = event.matches }
  function changeLanguage() { browserLanguage.value = navigator.language }
  function changeStorage(changes: { [key: string]: chrome.storage.StorageChange }, area: string) {
    if (area === 'local' && changes.preferences) apply(changes.preferences.newValue)
  }
  function changePreviewStorage(event: StorageEvent) {
    if (event.key === cacheKey) { try { apply(JSON.parse(event.newValue || 'null')) } catch { apply(defaults) } }
  }
  onMounted(() => {
    media.addEventListener('change', changeTheme)
    window.addEventListener('languagechange', changeLanguage)
    if (extension) chrome.storage.onChanged.addListener(changeStorage)
    else window.addEventListener('storage', changePreviewStorage)
  })
  onBeforeUnmount(() => {
    media.removeEventListener('change', changeTheme)
    window.removeEventListener('languagechange', changeLanguage)
    if (extension) chrome.storage.onChanged.removeListener(changeStorage)
    else window.removeEventListener('storage', changePreviewStorage)
  })
  async function loadPreferences() {
    if (!extension) return
    try { const data = await chrome.storage.local.get({ preferences: defaults }); apply(data.preferences) }
    catch { onError(t('Não foi possível carregar suas preferências.')) }
  }
  return { language, theme, locale, t, loadPreferences, applyPreferences: apply, flushPreferences: () => pendingWrite }
}
