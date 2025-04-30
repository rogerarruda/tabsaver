<template>
  <div class="min-h-screen bg-gray-100 p-8">
    <h1 class="text-4xl font-bold mb-8">Tab Saver Extension</h1>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div>
        <h2 class="text-2xl font-semibold mb-4">Currently Open Tabs</h2>
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-2xl font-semibold mb-2">Open Tabs ({{ openTabs.length }})</h3>
          <p class="text-sm text-gray-500 mb-4">Manage your currently open browser tabs</p>
          <ul class="space-y-2">
            <li v-for="tab in openTabs" :key="tab.id" class="flex items-center justify-between bg-gray-100 p-2 rounded">
              <span class="truncate flex-1">{{ tab.title }}</span>
              <div class="flex space-x-2">
                <button @click="openTab(tab.url)" class="p-2 rounded hover:bg-gray-200">
                  <ArrowTopRightOnSquareIcon class="w-4 h-4" />
                </button>
                <button @click="closeTab(tab.id)" class="p-2 rounded hover:bg-gray-200">
                  <XMarkIcon class="w-4 h-4" />
                </button>
              </div>
            </li>
          </ul>
          <button @click="saveCurrentTabs" class="mt-4 w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
            <ArrowPathIcon class="inline-block mr-2 w-4 h-4" />
            Save Current Tabs
          </button>
        </div>
      </div>

      <div>
        <h2 class="text-2xl font-semibold mb-4">Add New Collection</h2>
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-2xl font-semibold mb-2">Create Collection</h3>
          <p class="text-sm text-gray-500 mb-4">Add a new collection to organize your tabs</p>
          <div class="flex space-x-2">
            <input v-model="newCollectionName" class="flex-1 px-3 py-2 border rounded" placeholder="Collection Name" type="text">
            <button @click="addNewCollection" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
              <PlusCircleIcon class="inline-block mr-2 w-4 h-4" />
              Add
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-8">
      <h2 class="text-2xl font-semibold mb-4">Saved Collections</h2>
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-2xl font-semibold mb-2">Your Collections ({{ sortedCollections.length }})</h3>
        <p class="text-sm text-gray-500 mb-4">Total saved tabs: {{ sortedCollections.reduce((sum, col) => sum + col.tabs.length, 0) }}</p>
        <Disclosure v-for="(collection, index) in sortedCollections" :key="index" v-slot="{ open }" as="div" class="border-b last:border-b-0">
          <DisclosureButton class="flex w-full justify-between py-4 text-left text-sm font-medium focus:outline-none focus-visible:ring focus-visible:ring-opacity-75">
            <span>{{ collection.name }} ({{ collection.tabs.length }} tabs)</span>
            <ChevronUpIcon :class="open ? 'rotate-180 transform' : ''" class="h-5 w-5 text-gray-500" />
          </DisclosureButton>
          <DisclosurePanel class="pt-4 pb-2 text-sm text-gray-500">
            <ul class="">
              <li v-for="(tab, tabIndex) in collection.tabs" :key="tabIndex" class="flex flex-col border-t py-4">
                <span class="font-medium">{{ tab.title }}</span>
                <div class="flex items-center justify-between mt-1">
                  <a :href="tab.url" class="text-blue-500 hover:underline truncate" target="_blank">{{ tab.url }}</a>
                  <button @click="openTab(tab.url)" class="p-2 rounded hover:bg-gray-100">
                    <ArrowTopRightOnSquareIcon class="w-4 h-4" />
                  </button>
                </div>
              </li>
            </ul>
            <div class="flex justify-end space-x-2 mt-4">
              <button @click="editCollection(index)" class="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">
                <PencilIcon class="inline-block mr-1 w-4 h-4" />
                Edit
              </button>
              <button @click="restoreCollection(collection)" class="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600">
                <ArrowPathIcon class="inline-block mr-1 w-4 h-4" />
                Restore
              </button>
              <button @click="deleteCollection(index)" class="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600">
                <TrashIcon class="inline-block mr-1 w-4 h-4" />
                Delete
              </button>
            </div>
          </DisclosurePanel>
        </Disclosure>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue'
import { 
  ChevronUpIcon, 
  XMarkIcon, 
  ArrowTopRightOnSquareIcon, 
  PlusCircleIcon, 
  PencilIcon, 
  ArrowPathIcon, 
  TrashIcon 
} from '@heroicons/vue/24/outline'

const openTabs = ref([])
const collections = ref([])
const newCollectionName = ref('')

const sortedCollections = computed(() => {
  return [...collections.value].sort((a, b) => new Date(b.date) - new Date(a.date))
})

const loadOpenTabs = () => {
  chrome.tabs.query({ currentWindow: true }, (tabs) => {
    openTabs.value = tabs.map(tab => ({
      id: tab.id,
      title: tab.title,
      url: tab.url
    }))
  })
}

const saveCurrentTabs = async () => {
  const newCollection = {
    name: `Session ${new Date().toLocaleString()}`,
    tabs: openTabs.value.map(tab => ({ title: tab.title, url: tab.url })),
    date: new Date().toISOString()
  }

  await new Promise((resolve) => {
    chrome.storage.local.get({ collections: [] }, (data) => {
      const updatedCollections = [...data.collections, newCollection]
      chrome.storage.local.set({ collections: updatedCollections }, () => {
        loadSavedCollections()
        resolve(null)
      })
    })
  })

  const currentTab = await new Promise<chrome.tabs.Tab>((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0])
    })
  })

  const tabsToClose = openTabs.value
    .filter(tab => tab.id !== currentTab.id)
    .map(tab => tab.id)

  if (tabsToClose.length > 0) {
    chrome.tabs.remove(tabsToClose as number[], () => {
      loadOpenTabs() 
    })
  }
}

const loadSavedCollections = () => {
  chrome.storage.local.get({ collections: [] }, (data) => {
    collections.value = data.collections
  })
}

const addNewCollection = () => {
  if (newCollectionName.value) {
    const newCollection = {
      name: newCollectionName.value,
      tabs: [],
      date: new Date().toISOString()
    }
    chrome.storage.local.get({ collections: [] }, (data) => {
      const updatedCollections = [...data.collections, newCollection]
      chrome.storage.local.set({ collections: updatedCollections }, () => {
        loadSavedCollections()
        newCollectionName.value = ''
      })
    })
  }
}

const editCollection = (index) => {
  // Implementação futura
  console.log('Editing collection', sortedCollections.value[index])
}

const deleteCollection = (index) => {
  const collectionToDelete = sortedCollections.value[index]
  chrome.storage.local.get({ collections: [] }, (data) => {
    const updatedCollections = data.collections.filter(c => c.date !== collectionToDelete.date)
    chrome.storage.local.set({ collections: updatedCollections }, () => {
      loadSavedCollections()
    })
  })
}

const openTab = (url) => {
  chrome.tabs.create({ url })
}

const closeTab = (tabId) => {
  chrome.tabs.remove(tabId, () => {
    loadOpenTabs()
  })
}

const restoreCollection = (collection) => {
  collection.tabs.forEach(tab => {
    chrome.tabs.create({ url: tab.url })
  })
}

const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleString()
}

onMounted(() => {
  loadOpenTabs()
  loadSavedCollections()
  chrome.tabs.onCreated.addListener(loadOpenTabs)
  chrome.tabs.onRemoved.addListener(loadOpenTabs)
  chrome.tabs.onUpdated.addListener(loadOpenTabs)
})

onBeforeUnmount(() => {
  chrome.tabs.onCreated.removeListener(loadOpenTabs)
  chrome.tabs.onRemoved.removeListener(loadOpenTabs)
  chrome.tabs.onUpdated.removeListener(loadOpenTabs)
})
</script>
