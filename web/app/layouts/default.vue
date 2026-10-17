<script setup lang="ts">
const { siteName } = useRuntimeConfig().public
</script>

<template>
  <div class="shell">
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header">
      <div class="container site-header__inner">
        <NuxtLink to="/" class="brand">{{ siteName }}</NuxtLink>
        <nav aria-label="Main">
          <NuxtLink to="/">Home</NuxtLink>
          <NuxtLink to="/careers">Vacancies</NuxtLink>
        </nav>
      </div>
    </header>

    <main id="main" class="container site-main">
      <slot />
    </main>

    <footer class="site-footer">
      <div class="container">
        Content managed in Payload CMS · Hosted on Azure Static Web Apps
      </div>
    </footer>
  </div>
</template>
