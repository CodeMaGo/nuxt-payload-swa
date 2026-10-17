/**
 * Current time, available only after mount. Time-dependent UI (e.g. "closed"
 * badges) must not render during prerendering, or it would be frozen at build
 * time and cause hydration mismatches.
 */
export function useMountedNow() {
  const now = ref<Date | null>(null)
  onMounted(() => {
    now.value = new Date()
  })
  return now
}
