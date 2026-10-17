<script setup lang="ts">
import type { Career } from '#careers/types'
import { safeUrl, toExcerpt, toPlainText } from '#careers/rich-text'

const route = useRoute()
const slug = String(route.params.slug)
const { siteName, siteUrl } = useRuntimeConfig().public

const { data: career, error } = await useCareer(slug)

if (error.value || !career.value) {
  // A 404 is a real "not found". Anything else must fail loudly: during
  // `nuxt generate` this aborts the build instead of publishing an error page.
  const notFound = !error.value || error.value.statusCode === 404
  throw createError({
    statusCode: notFound ? 404 : 503,
    statusMessage: notFound ? 'Vacancy not found' : 'Vacancy could not be loaded',
    fatal: true,
  })
}

// Live check after mount: flags vacancies withdrawn since the last build.
const withdrawn = ref(false)
useRevalidate(async () => {
  try {
    career.value = await $fetch<Career>(`/api/careers/${encodeURIComponent(slug)}`)
  } catch (e) {
    if ((e as { statusCode?: number }).statusCode === 404) withdrawn.value = true
  }
})

const now = useMountedNow()
const closed = computed(() => withdrawn.value || isClosed(career.value?.closingDate, now.value))
const posted = computed(() => formatDate(career.value?.publishedAt))
const closing = computed(() => formatDate(career.value?.closingDate))
const applyUrl = computed(() => safeUrl(career.value?.applicationUrl))
const summary = computed(
  () => toExcerpt(career.value?.description, 160) ||`Apply for ${career.value?.title} at ${siteName}.`,
)

useSeoMeta({
  title: () => career.value?.title ?? 'Vacancy',
  description: () => summary.value,
  ogTitle: () => career.value?.title,
  ogDescription: () => summary.value,
  ogType: 'website',
})

// schema.org JobPosting structured data (eligibility for Google for Jobs).
useHead(() => ({
  link: siteUrl ? [{ rel: 'canonical', href: `${siteUrl.replace(/\/$/, '')}/careers/${slug}` }] : [],
  script: career.value
    ? [{
        type: 'application/ld+json',
        // Escape "<" so CMS content can never close the script element.
        innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'JobPosting',
          title: career.value.title,
          description: toPlainText(career.value.description) || career.value.title,
          datePosted: career.value.publishedAt ?? undefined,
          validThrough: career.value.closingDate ?? undefined,
          employmentType: career.value.employmentType?.toUpperCase().replace(/[^A-Z]+/g, '_'),
          hiringOrganization: { '@type': 'Organization', name: siteName },
          jobLocation: career.value.location
            ? { '@type': 'Place', address: career.value.location }
            : undefined,
        }).replace(/</g, '\\u003c'),
      }]
    : [],
}))
</script>

<template>
  <article v-if="career" class="vacancy">
    <NuxtLink to="/careers" class="back-link">← All vacancies</NuxtLink>

    <header class="vacancy__header">
      <p v-if="career.department" class="eyebrow">{{ career.department }}</p>
      <h1>{{ career.title }}</h1>
      <CareerMeta :career="career" />
      <p v-if="posted" class="vacancy__dates">
        Posted {{ posted }}<template v-if="closing"> · Closes {{ closing }}</template>
      </p>
    </header>

    <p v-if="closed" class="notice notice--warning" role="status">
      This vacancy is no longer accepting applications.
    </p>

    <RichText :value="career.description" />

    <p v-if="applyUrl && !closed" class="vacancy__apply">
      <a :href="applyUrl" class="button" target="_blank" rel="noopener noreferrer">Apply for this role</a>
    </p>
  </article>
</template>
