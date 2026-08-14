<script setup lang="ts">
import { computed } from 'vue'

interface ProcessTimelineEvent {
  id: string
  occurredAt: string
  title: string
  description?: string
  actorLabel?: string
}

const props = defineProps<{ events: ProcessTimelineEvent[] }>()

const orderedEvents = computed(() => [...props.events].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt)))
</script>

<template>
  <ol class="sgj-process-timeline">
    <li v-for="event in orderedEvents" :key="event.id">
      <time :datetime="event.occurredAt">{{ event.occurredAt }}</time>
      <strong>{{ event.title }}</strong>
      <span v-if="event.actorLabel">{{ event.actorLabel }}</span>
      <p v-if="event.description">{{ event.description }}</p>
    </li>
  </ol>
</template>
