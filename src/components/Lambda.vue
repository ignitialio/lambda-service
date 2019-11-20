<template>
  <div :id="id" v-if="!hidden" class="lambda-layout">
    <div class="lambda-left">
      <v-progress-linear v-if="loading"
        indeterminate class="lambda-progress-bar"></v-progress-linear>

      <v-list>
        <v-list-item v-for="fct in fcts" :key="fct.name"
          @click="handleSelected(fct)"
          class="lambda-item"
          :class="{ 'selected': selected === fct }">

          <v-list-item-content>
            <v-list-item-title v-text="fct.name"></v-list-item-title>
            <v-list-item-subtitle v-text="fct.description"></v-list-item-subtitle>
          </v-list-item-content>

          <v-list-item-action>
            <v-btn icon @click.stop="handleDelete(fct)">
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
      loading: false,
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
    update() {
      this.loading = true
      this.$db.collection('lambdafcts').then(lambdafcts => {
        lambdafcts.dFind({}).then(docs => {
          this.fcts = docs
          this.loading = false
        }).catch(err => {
          console.log(err)
          this.loading = true
        })
      }).catch(err => {
        console.log(err)
        this.loading = true
      })
    },
    handleCollectionUpdate(event) {
      console.log(event)
      this.update()
    },
    handleSelected(fct) {
      this.selected = fct
    },
    handleDelete(fct) {
      this.$db.collection('lambdafcts').then(lambdafcts => {
        lambdafcts.dDelete({ _id: fct._id }).then(result => {
          this.update()
        }).catch(err => {
          console.log(err)
          this.$services.emit('app:notification', this.$t('Modification failed'))
        })
      }).catch(err => {
        this.$services.emit('app:notification', this.$t('Modification failed'))
      })
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

    this.$ws.socket.on('service:event:dlake:lambdafcts:add', this._listeners.onCollectionUpdate)
    this.$ws.socket.on('service:event:dlake:lambdafcts:update', this._listeners.onCollectionUpdate)
    this.$ws.socket.on('service:event:dlake:lambdafcts:delete', this._listeners.onCollectionUpdate)

    this.update()
  },
  beforeDestroy() {
    this.$ws.socket.off('service:event:dlake:lambdafcts:add', this._listeners.onCollectionUpdate)
    this.$ws.socket.off('service:event:dlake:lambdafcts:update', this._listeners.onCollectionUpdate)
    this.$ws.socket.off('service:event:dlake:lambdafcts:delete', this._listeners.onCollectionUpdate)
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

.lambda-item.selected {
  background-color: rgba(30, 144, 255, 0.2);
}
</style>
