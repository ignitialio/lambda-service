<template>
  <div :id="id" v-if="!hidden" class="lambda-layout">
    <v-progress-linear v-if="loading"
      indeterminate class="lambda-progress-bar"></v-progress-linear>

    <div class="lambda-left">
      <v-list>
        <v-list-item v-for="(item, index) in items" :key="index"
          @click.stop="handleSelect(item)"
          @dblclick.stop="handleSelect(item, 'dblclick')"
          :class="{ 'selected': selected === item }">
          <v-list-item-avatar>
            <v-img :src="item.icon ?
              $utils.fileUrl(item.icon) : computeIcon(item)" alt=""></v-img>
          </v-list-item-avatar>

          <v-list-item-content>
            <v-list-item-title
              v-text="computeTitle(item)">
            </v-list-item-title>
            <v-list-item-subtitle v-text="item._id + ''"></v-list-item-subtitle>
          </v-list-item-content>

          <v-list-item-action>
            <v-btn icon @click.stop="handleDelete(item)">
              <v-icon color='red darken-1'>clear</v-icon>
            </v-btn>
          </v-list-item-action>
        </v-list-item>
      </v-list>
    </div>

    <fct class="lambda-right" :data="selected"></fct>
  </div>
</template>

<script>
import Fct from './Fct.vue'

export default {
  props: [ ],
  data: () => {
    return {
      id: 'lambda_' + Math.random().toString(36).slice(2),
      fcts: [],
      hidden: false,
      selected: {
        name: 'lambda_fct_' + Math.random().toString(36).slice(2),
        description: '',
        runtime: 'NodeJS 12',
        code: ''
      }
    }
  },
  components: {
    fct: Fct
  },
  methods: {
    handleCollectionUpdate() {

    }
  },
  mounted() {
    // dev
    // refresh service UI on hot reload
    this.$services.once('service:up', service => {
      if (service.name === 'lambda') {
        localStorage.setItem('HR_PATH', '/service-lambda')
        window.location.reload()
      }
    })

    this._listeners = {
      onCollectionUpdate: this.handleCollectionUpdate.bind(this)
    }

    this.$services.on('dlake:lambdafcts:add', this._listeners.onCollectionUpdate)
    this.$services.on('dlake:lambdafcts:update', this._listeners.onCollectionUpdate)
    this.$services.on('dlake:lambdafcts:delete', this._listeners.onCollectionUpdate)
  },
  beforeDestroy() {
    this.$services.off('', this._listeners.onCollectionUpdate)
  }
}
</script>

<style>
.lambda-layout {
  width: 100%;
  height: calc(100% - 0px);
  display: flex;
}

.lambda-progress-bar {
  position: absolute;
  width: 100%;
}

.lambda-left {
  position: relative;
  width: calc(33% - 16px);
  margin: 0 8px;
  border-right: 1px solid gainsboro;
}

.lambda-right {
  width: calc(67% - 16px);
  height: calc(100% - 0px);
  padding-bottom: 8px;
  margin: 0 8px;
}
</style>
