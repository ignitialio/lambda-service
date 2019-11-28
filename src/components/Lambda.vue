<template>
  <div :id="id" v-if="!hidden" class="lambda-layout">
    <div class="lambda-left">
      <v-progress-linear v-if="loading"
        indeterminate class="lambda-progress-bar"></v-progress-linear>

      <div class="lambda-search">
        <v-text-field v-model="search" solo append-icon="search" clearable
          :label="$t('Search')"></v-text-field>
      </div>

      <v-list>
        <v-list-item v-for="fct in fcts" :key="fct.name"
          @click="handleSelected(fct)"
          class="lambda-item"
          :class="{ 'selected': selected && ('' + selected._id === '' + fct._id) }">

          <v-list-item-content>
            <v-list-item-title v-text="fct.name"></v-list-item-title>
            <v-list-item-subtitle v-text="fct.description"></v-list-item-subtitle>
          </v-list-item-content>

          <v-list-item-action>
            <ig-btn-confirm class="lambda-btn--error"
              small text icon="clear" @click="handleDelete(fct)"></ig-btn-confirm>
          </v-list-item-action>
        </v-list-item>
      </v-list>
    </div>

    <fct v-if="selected" class="lambda-right" :data="selected"></fct>
  </div>
</template>

<script>
import filter from 'lodash/filter'
import Fct from './Fct.vue'

export default {
  props: [ ],
  data: () => {
    return {
      id: 'lambda_' + Math.random().toString(36).slice(2),
      fcts: [],
      hidden: false,
      loading: false,
      selected: null,
      search: ''
    }
  },
  watch: {
    search: function(val) {
      this.update()
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
          if (this.search !== '' && this.search.length > 2) {
            this.fcts =
              filter(docs, e => (e.name + ' ' + e.description).match(this.search))
          } else {
            this.fcts = docs
          }
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
      console.log('event', event)
      this.update()
    },
    handleSelected(fct) {
      this.$db.collection('lambdafcts').then(lambdafcts => {
        lambdafcts.dGet({ _id: fct._id }).then(doc => {
          this.selected = doc
          this.$forceUpdate()
          console.log('selected', $j(doc))
        }).catch(err => {
          console.log(err)
          this.selected = null
        })
      }).catch(err => {
        console.log(err)
        this.selected = null
      })
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
  min-width: 250px;
  width: 360px;
  max-width: calc(33% - 16px);
  border-right: 1px solid gainsboro;
  overflow-y: auto;
}

.lambda-right {
  flex: 1;
  height: calc(100% - 0px);
  padding: 8px;
}

.lambda-item.selected {
  background-color: rgba(30, 144, 255, 0.2);
}

.lambda-btn--error {
  width: 24px;
  height: 24px;
  color: tomato;
}

.lambda-search {
  padding: 24px 8px 0px 8px;
  background-color: rgba(30, 144, 255, 0.05);
  display: flex;
}
</style>
