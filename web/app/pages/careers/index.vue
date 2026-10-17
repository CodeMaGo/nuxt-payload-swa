<script setup lang="ts">
import type { PaginatedCareers } from '#careers/types'

const PAGE_SIZE = 12

const { data, error } = await useCareers(PAGE_SIZE)
const { careers, hasMore, loadMore, loading, failed } = useMoreCareers(data)

useRevalidate(async () => {
  data.value = await $fetch<PaginatedCareers>('/api/careers', { query: { limit: PAGE_SIZE } })
  error.value = undefined
})

useSeoMeta({
  title: 'Current vacancies',
  description: 'Browse our open positions and find your next role.',
})
</script>

<template>
  <h1>Current vacancies</h1>
  <p v-if="!error" class="lead">
    {{ data.totalDocs }} open {{ data.totalDocs === 1 ? 'position' : 'positions' }}
  </p>

  <p v-if="error" class="notice notice--error" role="alert">Unable to load vacancies. Please try again later.</p>
  <p v-else-if="!careers.length" class="notice">There are no current vacancies.</p>
  <template v-else>
    <CareerList :careers="careers" />
    <div v-if="hasMore" class="load-more">
      <button class="button button--secondary" type="button" :disabled="loading" @click="loadMore">
        {{ loading ? 'Loading…' : 'Load more vacancies' }}
      </button>
      <p v-if="failed" class="notice notice--error" role="alert">Couldn't load more vacancies.</p>
    </div>
  </template>
</template>
