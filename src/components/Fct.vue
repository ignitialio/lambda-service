<template>
  <div v-if="fct" class="fct-layout">
    <v-text-field :label="$t('Name') + '*'" v-model="fct.name" required
      style="max-width: 200px;"
      :items="runtimes"></v-text-field>

    <v-text-field :label="$t('Description')" v-model="fct.description"></v-text-field>

    <v-select :label="$t('Runtime') + '*'" required
      style="max-width: 200px;"
      :items="runtimes" v-model="fct.runtime"></v-select>

    <div class="fct-section">
      {{ $t('Docker image') }}
      <v-btn color="blue darken-1" icon text
        @click="handleBuildImage" dark>
        <v-icon>build</v-icon>
      </v-btn>
    </div>

    <div v-if="fct.imageName">{{ fct.imageName }}</div>
    <div v-if="building" style="text-align: center;">
      <v-progress-circular color="blue lighten-1" indeterminate></v-progress-circular>
    </div>
    <div v-if="!fct.imageName">{{ $t('No associated image available') }}</div>

    <div class="fct-section">{{ $t('Source code') }}*</div>

    <prism-editor ref="editor" lineNumbers class="fct-editor"
      :code="fct.code" @change="handleChange" language="js"></prism-editor>

    <div class="fct-section">
      {{ $t('Test') }}
      <v-btn color="blue darken-1" icon text :disabled="!fct.imageName"
        @click="handleRun" :disable="running" dark>
        <v-icon>play_arrow</v-icon>
      </v-btn>

      <v-progress-circular v-if="running"
        color="blue lighten-1" indeterminate></v-progress-circular>
    </div>

    <v-textarea style="margin-top: 16px" :disabled="!fct.imageName"
      :label="$t('Result')" :value="result"
      readonly outlined rows="6"></v-textarea>
  </div>
</template>

<script>
import cloneDeep from 'lodash/cloneDeep'

export default {
  props: {
    data: {
      type: Object,
      required: true
    }
  },
  data: () => {
    return {
      runtimes: [
        'NodeJS 12',
        'Python 2.7'
      ],
      fct: null,
      modified: false,
      running: false,
      building: false,
      result: ''
    }
  },
  watch: {
    data: {
      handler: function(val) {
        this.building = false
        if (JSON.stringify(val) !== JSON.stringify(this.fct)) {
          this.fct = cloneDeep(val)

          this.updateImageStatus()
        }
      },
      deep: true
    },
    fct: {
      handler: function(val) {
        if (this.lastFct && this.lastFct !== JSON.stringify(val)) {
          if (JSON.stringify(this.data) !== JSON.stringify(val)) {
            this.modified = true
          }

          this.lastFct = JSON.stringify(val)
        }
      },
      deep: true
    },
    modified: function(val) {
      this.$services.emit('view:lambda:modified', val)
    }
  },
  computed: {

  },
  methods: {
    handleNew() {
      this.$services.lambda.template().then(code => {
        this.codeTempalte = code

        this.fct = {
          name: 'lambda_fct_' + Math.random().toString(36).slice(2),
          description: '',
          runtime: 'NodeJS 12',
          code: this.codeTempalte,
          archive: null,
          dependencies: []
        }

        this.lastFct = JSON.stringify(this.fct)

        this.$emit('update:data', this.fct)

        // vuetify issue with code tag
        setTimeout(() => {
          this.updateCss()
          this.modified = false
        }, 1000)
      }).catch(err => console.log(err))
    },
    async handleSave() {
      try {
        let fctsCollection = await this.$db.collection('lambdafcts')

        if (this.fct._id) {
          await fctsCollection.dUpdate({ _id: this.fct._id }, this.fct)
        } else {
          let result = await fctsCollection.dPut(this.fct)
          this.fct._id = result._id
          this.$emit('update:data', this.fct)
        }

        this.modified = false
        this.$services.emit('app:notification', this.$t('Modification done'))
      } catch (err) {
        console.log(err)
        this.$services.emit('app:notification', this.$t('Modification failed'))
      }
    },
    handleRun() {
      this.running = true
      if (this.fct.imageName) {
        this.$services.lambda.run(this.fct).then(() => {
          let onDone = done => {
            this.running = false
            this.result = done.result
            this.fct = done.fct

            this.$ws.socket.off('service:event:lambda:run:error', onError)
          }

          let onError = err => {
            this.running = false
            console.log('run service ERROR', err)
            this.$ws.socket.off('service:event:lambda:run:done', onDone)
          }

          this.$ws.socket.once('service:event:lambda:run:done', onDone)
          this.$ws.socket.once('service:event:lambda:run:error', onError)
        }).catch(err => {
          this.running = false
          this.$services.emit('app:notification', this.$t('Failed to run function'))
          console.log(err)
        })
      } else {
        console.log('image missing')
      }
    },
    handleBuildImage() {
      this.building = true

      this.$services.lambda.build(this.fct).then(() => {
        let onDone = imageName => {
          console.log('image ' + imageName + 'built')
          this.building = false
          this.$ws.socket.off('service:event:lambda:build:error', onError)
          this.fct.imageName = imageName
        }

        let onError = err => {
          console.log('image build ERROR', err)
          this.building = false
          this.$ws.socket.off('service:event:lambda:build:done', onDone)
        }

        this.$ws.socket.once('service:event:lambda:build:done', onDone)
        this.$ws.socket.once('service:event:lambda:build:error', onError)
      }).catch(err => {
        this.$services.emit('app:notification', this.$t('Failed to build image'))
        this.building = false
        console.log(err)
      })
    },
    updateCss() {
      if (this.$refs.editor) {
        let code = this.$refs.editor.$el.getElementsByTagName('code')[0]
        code.style.boxShadow = 'none'
      }
    },
    handleChange(val) {
      this.fct.code = val

      // vuetify issue with code tag
      setTimeout(() => {
        this.updateCss()
      }, 200)

      switch (this.fct.runtime) {
        case 'NodeJS 12':
          if (!this.fct.archive) {
            let dependencies = this.fct.code.match(/require\('(.*?)'\)/g)
            if (dependencies) {
              this.fct.dependencies = []
              for (let lib of dependencies) {
                lib = lib.match(/require\('(.*?)'\)/)[1]
                this.fct.dependencies.push({
                  name: lib,
                  version: undefined
                })
              }
            }
          }
          break
      }

      this.$emit('update:data', this.fct)
    },
    updateImageStatus() {
      if (this.fct) {
        this.$services.waitForService('lambda').then(lambda => {
          lambda.isImageAvailable(this.fct).then(imageName => {
            this.fct.imageName = imageName
            this.$forceUpdate()
            console.log('image', imageName)
          }).catch(err => {
            console.log('error', err)
            this.fct.imageName = null
          })
        })
      }
    }
  },
  mounted() {
    this._listeners = {
      onSave: this.handleSave.bind(this),
      onNew: this.handleNew.bind(this)
    }

    this.$services.on('view:lambda:new', this._listeners.onNew)
    this.$services.on('view:lambda:save', this._listeners.onSave)

    if (this.data.name) {
      this.fct = cloneDeep(this.data)
      this.lastFct = JSON.stringify(this.fct)

      this.updateImageStatus()

      // vuetify issue with code tag
      setTimeout(() => {
        this.updateCss()
        this.modified = false
      }, 1000)
    } else {
      this.handleNew()
    }

    // show contextual menu bar
    this.$services.emit('app:context:bar', 'lambda-ctx')
  },
  beforeDestroy() {
    this.$services.off('view:lambda:new', this._listeners.onNew)
    this.$services.off('view:lambda:save', this._listeners.onSave)

    // show contextual menu bar
    this.$services.emit('app:context:bar', null)
  }
}
</script>

<style scoped>
.fct-layout {
  width: 100%;
  height: calc(100% - 0px);
  overflow-y: auto;
}

.fct-editor {
  margin: 8px;
  width: calc(100% - 16px);
  height: 500px;
}

.fct-section {
  border-top: 1px solid gainsboro;
  margin: 16px 0;
  padding-top: 16px;
  width: 100%;
  color: dimgray;
  font-weight: bold;
  display: flex;
  align-items: center;
}
</style>
