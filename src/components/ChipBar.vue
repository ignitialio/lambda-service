<template>
  <div v-if="fct" class="chipbar-layout">
    <div class="chipbar-item" v-for="(item, index) of data" :key="item.tag">
      <span style="margin-right: 32px;">
        {{ dep.tag }}</span>
      <v-icon class="chipbar-item--status" 
        v-if="item.status && item.status === 'off'" color="grey">error</v-icon>
      <v-icon class="chipbar-item--status"
      v-if="item.status && item.status === 'on'" color="green lighten-1">done</v-icon>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    data: {
      type: Array,
      required: true
    }
  },
  data: () => {
    return {
    }
  },
  watch: {
  },
  computed: {
  },
  methods: {
    handleNew() {
    }
  },
  mounted() {
  },
  beforeDestroy() {
  }
}
</script>

<style scoped>
.chipbar-layout {
  width: 100%;
  height: calc(100% - 0px);
  overflow-y: auto;
  display: flex;
  flex-wrap: wrap;
  min-height: 48px;
  align-items: flex-start;
  justify-content: flex-start;
}

.chipbar-item {
  background-color: navajowhite;
  border-radius: 12px;
  height: 24px;
  padding: 0 12px;
  margin: 0 4px;
  position: relative;
}

.chipbar-item--status {
  position: absolute;
  right: 0;
  top: 0;
}
</style>
