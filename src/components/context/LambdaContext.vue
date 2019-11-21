<template>
  <div class="lambdactx-layout">
    <div style="flex: 1"></div>

    <div class="lambdactx-divider"></div>

    <v-btn icon light text color="blue darken-1" @click="handleSave"
      :disabled="!modified">
      <v-icon>save</v-icon>
    </v-btn>

    <v-btn icon text color="blue darken-1" @click="handleNew">
      <v-icon>add</v-icon>
    </v-btn>

    <div class="lambdactx-divider"></div>
  </div>
</template>

<script>
export default {
  name: 'lambda-ctx',
  data: () => {
    return {
      modified: false
    }
  },
  methods: {
    handleNew() {
      this.$services.emit('view:lambda:new')
    },
    handleSave() {
      this.$services.emit('view:lambda:save')
    },
    handleItemModified(status) {
      this.modified = status
    }
  },
  mounted() {
    this._listeners = {
      onItemModified: this.handleItemModified.bind(this)
    }

    this.$services.on('view:lambda:modified', this._listeners.onItemModified)
  },
  beforeDestroy() {
    this.$services.off('view:lambda:modified', this._listeners.onItemModified)
  }
}
</script>

<style scoped>
.lambdactx-layout {
  width: full;
  height: calc(100% - 0px);
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.lambdactx-divider {
  height: 32px;
  border-left: 1px solid gainsboro;
}

@media screen and (max-width: 800px) {

}
</style>
