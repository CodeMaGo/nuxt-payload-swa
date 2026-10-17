<script setup lang="ts">
import type { PaginatedCareers } from '#careers/types'

const LATEST = 3
const { siteName } = useRuntimeConfig().public
const { data, error } = await useCareers(LATEST)

useRevalidate(async () => {
  data.value = await $fetch<PaginatedCareers>('/api/careers', { query: { limit: LATEST } })
  error.value = undefined
})

useSeoMeta({
  description: `Explore the latest career opportunities at ${siteName}.`,
})
</script>

<template>
  <section class="hero">
    <h1>Join our team</h1>
    <p class="lead">Do the best work of your career with people who care about the craft.</p>
    <NuxtLink to="/careers" class="button">View all vacancies</NuxtLink>
  </section>

  <section aria-labelledby="latest-heading">
    <div class="section-heading">
      <h2 id="latest-heading">Latest vacancies</h2>
      <NuxtLink v-if="data.totalDocs > data.docs.length" to="/careers">
        See all {{ data.totalDocs }}
      </NuxtLink>
    </div>

    <p v-if="error" class="notice notice--error" role="alert">Vacancies could not be loaded.</p>
    <p v-else-if="!data.docs.length" class="notice">There are no current vacancies.</p>
    <CareerList v-else :careers="data.docs" heading-level="h3" />
  </section>
</template>
