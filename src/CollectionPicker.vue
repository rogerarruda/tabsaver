<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ChevronDown, Search, Plus, Folder } from 'lucide-vue-next'
import { recentCollections } from './collections'
import type { Collection } from './collections'
const props = defineProps<{ modelValue: string; collections: Collection[]; t: (text: string) => string; label: string; allowNew?: boolean; excludedKey?: string; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const root = ref<HTMLDetailsElement | null>(null)
const search = ref<HTMLInputElement | null>(null)
const query = ref('')
const options = computed(() => recentCollections(props.collections).filter(c => c.key !== props.excludedKey && `${c.name} ${(c.tags || []).join(' ')}`.toLocaleLowerCase().includes(query.value.toLocaleLowerCase())))
const caption = computed(() => props.modelValue === 'new' ? props.t('Nova coleção') : props.collections.find(c => c.key === props.modelValue)?.name || props.label)
function choose(key: string) { if (props.disabled) return; emit('update:modelValue', key); close() }
function close() { if (!root.value) return; root.value.open = false; root.value.querySelector('summary')?.focus() }
async function toggled() { if (root.value?.open) { if (props.disabled) { root.value.open = false; return }; query.value = ''; await nextTick(); search.value?.focus() } }
function outside(event: Event) { if (root.value && !root.value.contains(event.target as Node)) root.value.open = false }
onMounted(() => document.addEventListener('pointerdown', outside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside))
</script>
<template><details ref="root" class="collection-picker" @toggle="toggled" @keydown.esc.stop.prevent="close"><summary :aria-label="label" :aria-disabled="disabled" @click="disabled && $event.preventDefault()"><span>{{ caption }}</span><ChevronDown :size="14" /></summary><div class="picker-menu"><label class="picker-search"><Search :size="15" /><input ref="search" v-model="query" type="search" :placeholder="t('Buscar coleção')" :aria-label="t('Buscar coleção')" /></label><div class="picker-options"><button v-if="allowNew" type="button" class="picker-option" :aria-pressed="modelValue === 'new'" @click="choose('new')"><Plus :size="16" /><span>{{ t('Nova coleção') }}</span></button><p class="picker-order">{{ t('Mais recentes primeiro') }}</p><button v-for="c in options" :key="c.key" type="button" class="picker-option" :disabled="disabled || c.unreadableTabs" :aria-pressed="modelValue === c.key" @click="choose(c.key!)"><Folder :size="15" /><span>{{ c.name }}<small>{{ c.tabs.length }} {{ t('abas') }}</small></span></button><p v-if="!options.length" class="picker-empty">{{ t('Nenhuma coleção encontrada.') }}</p></div></div></details></template>
