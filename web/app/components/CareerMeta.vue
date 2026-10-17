<script setup lang="ts">
import type { Career } from '#careers/types'

defineProps<{ career: Career }>()
</script>

<template>
  <ul class="meta" aria-label="Vacancy details">
    <li v-if="career.department"><span class="sr-only">Department: </span>{{ career.department }}</li>
    <li v-if="career.location"><span class="sr-only">Location: </span>{{ career.location }}</li>
    <li v-if="career.employmentType"><span class="sr-only">Employment type: </span>{{ career.employmentType }}</li>
  </ul>
</template>
