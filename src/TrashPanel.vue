<script setup lang="ts">
import { computed } from 'vue'
import { Trash2, RotateCcw, Folder, File } from '@lucide/vue'
import type { TrashEntry } from './trash'
import { readCollections } from './collections'
const props = defineProps<{ entries: TrashEntry[]; t: (text: string) => string; locale: string; busy: boolean }>()
defineEmits<{ restore: [entry: TrashEntry]; remove: [entry: TrashEntry]; empty: [] }>()
const sorted = computed(() => [...props.entries].sort((a,b) => b.deletedAt.localeCompare(a.deletedAt)))
function name(entry: TrashEntry) { return entry.kind === 'tab' ? entry.tab?.title : readCollections([entry.source])[0].name }
</script>
<template><section class="trash-panel" :aria-label="t('Lixeira')"><header><div><h2>{{ t('Lixeira') }} <span>{{ entries.length }}</span></h2><p>{{ t('Os itens ficam aqui até você restaurar ou excluir definitivamente.') }}</p></div><button v-if="entries.length" class="button" :disabled="busy" @click="$emit('empty')"><Trash2 :size="15" />{{ t('Esvaziar lixeira') }}</button></header><p v-if="!entries.length" class="empty-state">{{ t('A lixeira está vazia.') }}</p><article v-for="entry in sorted" :key="entry.id" class="trash-item"><span class="folder-tile sand"><component :is="entry.kind === 'collection' ? Folder : File" :size="20" /></span><div class="trash-item-info"><h3>{{ name(entry) }}</h3><p>{{ entry.kind === 'collection' ? t('Coleção') : t('Aba') }} · {{ new Date(entry.deletedAt).toLocaleString(locale) }}</p><small v-if="entry.kind === 'tab'">{{ entry.tab?.url }}</small></div><div class="trash-item-actions"><button class="button" :disabled="busy" @click="$emit('restore', entry)"><RotateCcw :size="14" />{{ t('Restaurar') }}</button><button class="icon-button delete-button" :disabled="busy" :aria-label="t('Excluir definitivamente')" @click="$emit('remove', entry)"><Trash2 :size="17" /></button></div></article><p v-if="entries.some(entry => entry.kind === 'tab')" class="trash-explanation">{{ t('Abas restauradas voltam à coleção original quando ela é encontrada. Caso contrário, uma coleção é recriada.') }}</p></section></template>
