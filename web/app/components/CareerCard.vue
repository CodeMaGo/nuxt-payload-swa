<script setup lang="ts">
import type { Career } from '#careers/types'
import { toExcerpt } from '#careers/rich-text'

const props = defineProps<{ career: Career; headingLevel?: 'h2' | 'h3' }>()

const excerpt = computed(() => toExcerpt(props.career.description, 180))
const closing = computed(() => formatDate(props.career.closingDate))
const now = useMountedNow()
const closed = computed(() => isClosed(props.career.closingDate, now.value))
</script>

<template>
  <article class="career-card">
    <component :is="headingLevel ?? 'h2'" class="career-card__title">
      <!-- A single stretched link makes the whole card clickable. -->
      <NuxtLink :to="`/careers/${career.slug}`" class="stretched-link">{{ career.title }}</NuxtLink>
    </component>
    <CareerMeta :career="career" />
    <p v-if="excerpt" class="career-card__excerpt">{{ excerpt }}</p>
    <p v-if="closing" class="career-card__closing">
      <span v-if="closed" class="badge badge--closed">Closed</span>
      <template v-else>Apply by {{ closing }}</template>
    </p>
  </article>
</template>
