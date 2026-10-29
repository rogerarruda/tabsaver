<script setup lang="ts">
import { computed, ref, watch } from 'vue'
const props = defineProps<{ url: string; compact?: boolean }>()
const failed = ref(false)
const letter = computed(() => { try { return new URL(props.url).hostname.replace(/^www\./, '').charAt(0).toUpperCase() || '·' } catch { return '·' } })
const icon = computed(() => {
  if (typeof chrome === 'undefined' || !chrome.runtime?.getURL) return ''
  const base = chrome.runtime.getURL('/_favicon/')
  if (!base.startsWith('chrome-extension://')) return ''
  const url = new URL(base); url.searchParams.set('pageUrl', props.url); url.searchParams.set('size', '32'); return url.href
})
watch(() => props.url, () => failed.value = false)
</script>
<template><span class="site-letter" :class="{ 'site-icon-compact': compact }" aria-hidden="true"><img v-if="icon && !failed" :src="icon" alt="" loading="lazy" width="16" height="16" @error="failed = true" /><template v-else>{{ letter }}</template></span></template>
