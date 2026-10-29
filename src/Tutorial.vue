<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { CircleHelp, Settings2, X, ArrowRight, ArrowLeft, LayoutGrid, ArrowDownToLine, Folder, ShieldCheck, SunMoon, Check, ExternalLink } from 'lucide-vue-next'
import brandIcon from '../images/tabsaver-icon.svg'
const props = defineProps<{ t: (text: string, params?: Record<string, string | number>) => string }>()
const emit = defineEmits<{ modal: [open: boolean]; notice: [text: string] }>()
const open = ref(false)
const step = ref(0)
const error = ref('')
const trigger = ref<HTMLButtonElement | null>(null)
const setupExpanded = ref(false)
let returnFocus: HTMLElement | null = null
const title = ref<HTMLHeadingElement | null>(null)
const saving = ref(false)
const extension = typeof chrome !== 'undefined' && !!chrome.storage?.local && !!chrome.tabs
const steps = [
  { icon: LayoutGrid, title: 'Seu novo ponto de partida', intro: 'Abra seu espaço pela nova aba ou pelo ícone da extensão.', detail: 'Ao instalar e ativar a extensão, a página de nova aba já é configurada pelo TabSaver.', tip: 'Para abrir o TabSaver sem mudar sua nova aba, clique no ícone dele no menu de extensões do Chrome.' },
  { icon: ArrowDownToLine, title: 'Guarde agora. Continue depois.', intro: 'Veja as abas da janela atual no painel “Abas abertas”.', detail: 'Marque as abas que deseja guardar e escolha o destino em “Salvar em”. Você pode criar uma sessão ou usar uma coleção existente, ignorar duplicatas e decidir se as abas serão fechadas após salvar.', tip: 'Apenas as abas da janela atual são incluídas. Salvar não apaga suas coleções anteriores.' },
  { icon: Folder, title: 'Encontre seu caminho de volta', intro: 'Cada sessão salva vira uma coleção para você retomar quando quiser.', detail: 'Use a busca para encontrar nomes, títulos ou sites. “Ver abas” mostra o conteúdo; “Abrir coleção” reabre todas as abas. O lápis renomeia a coleção.', tip: '“Nova coleção” cria um espaço vazio. Expanda “Ver abas” para adicionar um endereço, remover abas ou movê-las. Use a estrela para favoritar e o lápis para editar nome e etiquetas.' },
  { icon: ShieldCheck, title: 'Leve suas coleções com você', intro: 'Os dados ficam neste navegador. Faça um backup para ter uma cópia em arquivo.', detail: '“Exportar backup” salva suas coleções e preferências em JSON. Em “Restaurar backup”, escolha adicionar às coleções atuais ou substituí-las. Confira a prévia antes de confirmar.', tip: '“Desfazer restauração” recupera a cópia anterior à última importação. O backup por arquivo não sincroniza os dados automaticamente.' },
  { icon: SunMoon, title: 'Um espaço do seu jeito', intro: 'Escolha seu idioma e a aparência nos seletores no topo da página.', detail: 'Idioma automático acompanha o navegador: português usa PT-BR e os demais idiomas usam inglês. A aparência pode seguir o sistema ou ficar sempre clara ou escura.', tip: 'Você pode reabrir este tutorial pelo botão “Como usar”, no topo da página.' },
]
const current = computed(() => steps[step.value])
async function focusTitle() { await nextTick(); title.value?.focus({ preventScroll: true }); if (title.value) title.value.closest('.modal')!.scrollTop = 0 }
function show(configure = false, event?: Event) { returnFocus = event?.currentTarget as HTMLElement || trigger.value; setupExpanded.value = configure; step.value = 0; error.value = ''; open.value = true; emit('modal', true); focusTitle() }
function move(next: number) { step.value = next; error.value = ''; focusTitle() }
async function finish() {
  if (saving.value) return
  saving.value = true; error.value = ''
  try {
    if (extension) await chrome.storage.local.set({ tutorialSeen: true })
    else localStorage.setItem('tabsaver-tutorial-seen', 'true')
  } catch { emit('notice', props.t('Não foi possível salvar a conclusão do tutorial. Tente novamente.')) }
  finally { saving.value = false; open.value = false; emit('modal', false); await nextTick(); (returnFocus || trigger.value)?.focus() }
}
async function openExtensions() {
  try { await chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` }) }
  catch { error.value = props.t('Digite chrome://extensions na barra de endereços para verificar a extensão.') }
}
function trap(event: KeyboardEvent) {
  const items = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('button:not(:disabled), a[href], summary')].filter(el => el.getClientRects().length > 0)
  const first = items[0], last = items[items.length - 1]
  if (!first) { event.preventDefault(); return }
  if (event.shiftKey && (document.activeElement === first || document.activeElement === title.value)) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
onMounted(async () => {
  try {
    const seen = extension ? (await chrome.storage.local.get({ tutorialSeen: false })).tutorialSeen : localStorage.getItem('tabsaver-tutorial-seen') === 'true'
    if (!seen) show()
  } catch { /* Manual help remains available if storage cannot be read. */ }
})
</script>
<template>
  <div class="tutorial-links"><button class="tutorial-trigger setup-trigger" @click="show(true, $event)"><Settings2 :size="16" /><span>{{ t('Configurar nova aba') }}</span></button><button ref="trigger" class="tutorial-trigger" @click="show(false, $event)"><CircleHelp :size="16" /><span>{{ t('Como usar') }}</span></button></div>
  <Teleport to="body"><div v-if="open" class="modal-backdrop tutorial-backdrop" @keydown.esc="finish"><section class="modal tutorial-modal" role="dialog" aria-modal="true" aria-labelledby="tutorial-title" @keydown.tab="trap">
    <header class="tutorial-top"><span class="tutorial-brand"><img class="tutorial-logo" :src="brandIcon" alt="" width="28" height="28" />TabSaver</span><button class="icon-button" :disabled="saving" :aria-label="t('Fechar tutorial')" @click="finish"><X :size="20" /></button></header>
    <div class="tutorial-progress" :aria-label="t('Passo {current} de {total}', { current: step + 1, total: steps.length })"><span v-for="(_, index) in steps" :key="index" :class="{ complete: index <= step }"></span></div>
    <p class="tutorial-step">{{ t('Passo {current} de {total}', { current: step + 1, total: steps.length }) }}</p>
    <div class="tutorial-illustration" aria-hidden="true"><div class="tutorial-window"><span></span><span></span><span></span><div class="tutorial-window-line"></div></div><div class="tutorial-visual"><span class="tutorial-symbol"><component :is="current.icon" :size="35" :stroke-width="1.5" /></span><div class="tutorial-lines"><span></span><span></span><span></span></div><span class="tutorial-check"><Check :size="19" /></span></div></div>
    <h2 id="tutorial-title" ref="title" tabindex="-1">{{ t(current.title) }}</h2><p class="tutorial-intro">{{ t(current.intro) }}</p><p class="tutorial-detail">{{ t(current.detail) }}</p>
    <details v-if="step === 0" :open="setupExpanded" class="tutorial-setup"><summary>{{ t('Não abriu o TabSaver?') }}</summary><ol><li>{{ t('Abra chrome://extensions e confira se o TabSaver está ativado.') }}</li><li>{{ t('Se o Chrome pedir confirmação para usar a página do TabSaver, mantenha a mudança.') }}</li><li>{{ t('Verifique se outra extensão está controlando a nova aba. Se necessário, desative essa outra extensão e tente novamente.') }}</li></ol><button v-if="extension" class="text-button" @click="openExtensions">{{ t('Verificar extensão no Chrome') }}<ExternalLink :size="14" /></button><p v-else class="tutorial-preview">{{ t('Esta é uma prévia. A configuração de nova aba funciona com a extensão instalada no Chrome.') }}</p></details>
    <p class="tutorial-tip">{{ t(current.tip) }}</p>
    <p v-if="error" class="backup-error" role="alert">{{ error }}</p>
    <footer class="tutorial-actions"><button v-if="step === 0" class="text-button" :disabled="saving" @click="finish">{{ t('Ver depois') }}</button><button v-else class="button" :disabled="saving" @click="move(step - 1)"><ArrowLeft :size="16" />{{ t('Voltar') }}</button><button v-if="step < steps.length - 1" class="button primary" @click="move(step + 1)">{{ t('Próximo') }}<ArrowRight :size="16" /></button><button v-else class="button primary" :disabled="saving" @click="finish"><Check :size="16" />{{ t('Começar a usar') }}</button></footer>
  </section></div></Teleport>
</template>
