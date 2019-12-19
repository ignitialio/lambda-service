<template>
  <div v-if="fct" class="fct-layout">
    <v-text-field :label="$t('Name') + '*'" v-model="fct.name" required
      style="max-width: 200px;"
      :items="runtimes"></v-text-field>

    <v-text-field :label="$t('Description')" v-model="fct.description"></v-text-field>

    <v-select :label="$t('Runtime') + '*'" required
      style="max-width: 200px;"
      :items="runtimes" v-model="fct.runtime"></v-select>

    <v-row>
      <v-col cols="6">
        <div class="fct-section">
          {{ $t('Status') }}
        </div>

        <div class="fct-row">
          <div class="fct-row--header">{{ $t('Docker image') }}</div>

          <div class="fct-row--label" v-if="fct.imageName">
            {{ fct.imageName }}</div>
          <div class="fct-row--label" v-if="!fct.imageName">
            {{ $t('No associated image available') }}</div>
          <div v-if="building" style="text-align: center;">
            <v-progress-circular color="blue lighten-1" indeterminate></v-progress-circular>
          </div>
        </div>

        <div class="fct-row">
          <div class="fct-row--header">{{ $t('Execution status') }}</div>

          <div class="fct-row--label"
            v-if="fct.execution && fct.execution.container">{{ fct.execution.container }}</div>
          <div class="fct-row--label"
            v-if="!(fct.execution && fct.execution.container)">
            {{ $t('No associated container') }}</div>
          <div v-if="activating" style="text-align: center;">
            <v-progress-circular color="blue lighten-1" indeterminate></v-progress-circular>
          </div>
        </div>
      </v-col>

      <v-col cols="6">
        <div class="fct-section">
          {{ $t('Test') }}

          <v-progress-circular v-if="running"
            color="blue lighten-1" indeterminate></v-progress-circular>
        </div>

        <v-textarea style="margin-top: 16px" :disabled="!fct.imageName"
          :label="$t('Result')" :value="result"
          readonly outlined rows="6"></v-textarea>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12">
        <div>
          <v-btn color="blue darken-1" icon text light
            @click="handleBuildImage">
            <v-icon>build</v-icon>
          </v-btn>

          <v-btn color="blue darken-1" icon text light
            :disabled="!fct.imageName"
            @click="handleActivate">
            <v-icon>power_settings_new</v-icon>
          </v-btn>

          <v-btn color="blue darken-1" icon text light
            :disabled="!(fct.execution && fct.execution.container)"
            @click="handleRun" :disable="running">
            <v-icon>play_arrow</v-icon>
          </v-btn>

          <v-btn color="red darken-1" icon text light
            :disabled="!(fct.execution && fct.execution.container)"
            @click="handleClean" :disable="running">
            <v-icon>clear</v-icon>
          </v-btn>
        </div>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12">
        <v-stepper v-model="statusProgress">
          <v-stepper-header>
            <v-stepper-step v-for="(status, index) in statusList" :key="status"
              :complete="fct.execution && fct.execution.status === status"
              step="">{{ status }}</v-stepper-step>
          </v-stepper-header>
        </v-stepper>
      </v-cols>
    </v-row>

    <div class="fct-section">{{ $t('Source code') }}*</div>

    <prism-editor ref="editor" lineNumbers class="fct-editor"
      :code="fct.code" @change="handleChange" language="js"></prism-editor>
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
      activating: false,
      running: false,
      building: false,
      result: '',
      statusProgress: 1,
      statusList: [ 'undefined', 'built', 'activated', 'running', 'stopped' ]
    }
  },
  watch: {
    data: {
      handler: function(val) {
        this.building = false
        if (JSON.stringify(val) !== JSON.stringify(this.fct)) {
          this.fct = cloneDeep(val)

          this.computeStatus()
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
        this.codeTemplate = code

        this.fct = {
          name: 'lambda_fct_' + Math.random().toString(36).slice(2),
          description: '',
          runtime: 'NodeJS 12',
          code: this.codeTemplate,
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
    async handleSave(nomsg) {
      try {
        let fctsCollection = await this.$db.collection('lambdafcts')

        if (this.fct._id) {
          let result = await fctsCollection.dUpdate({ _id: this.fct._id }, this.fct)
          console.log('update', result, $j(this.fct), typeof this.fct._id)
        } else {
          let result = await fctsCollection.dPut(this.fct)
          this.fct._id = result._id
          this.$emit('update:data', this.fct)
        }

        this.modified = false
        if (!nomsg) {
          this.$services.emit('app:notification', this.$t('Modification done'))
        }
      } catch (err) {
        if (!nomsg) {
          this.$services.emit('app:notification', this.$t('Modification failed'))
        }
        console.log('error', err)
      }
    },
    handleActivate() {
      this.activating = true
      if (this.fct.imageName) {
        this.$services.lambda.activate(this.fct).then(() => {
          let onDone = fct => {
            console.log(fct)
            fct = this.$encoders.bson.unpack(fct)
            this.activating = false
            this.fct = fct
            this.$forceUpdate()
            console.log('activation', $j(this.fct.execution))
            this.$ws.socket.off('_bson:service:event:lambda:activate:error', onError)
            this.handleSave(true)
          }

          let onError = fct => {
            fct = this.$encoders.bson.unpack(fct)
            this.activating = false
            this.fct = fct
            this.$ws.socket.off('_bson:service:event:lambda:activate:done', onDone)

            this.$services.emit('app:notification', this.$t('Failed to activate function'))
            this.handleSave(true)
            console.log('activate service ERROR', fct.err)
          }

          this.$ws.socket.once('_bson:service:event:lambda:activate:done', onDone)
          this.$ws.socket.once('_bson:service:event:lambda:activate:error', onError)
        }).catch(err => {
          this.fct.execution.status = 'error'
          this.fct.error = '' + err
          this.activating = false
          this.$services.emit('app:notification', this.$t('Failed to activate function'))
          this.handleSave(true)
          console.log(err)
        })
      } else {
        console.log('image missing')
      }

    },
    handleRun() {
      if (this.fct.execution && this.fct.execution.container) {
        this.$services.lambda.run(this.fct).then(() => {
          let onDone = async done => {
            done = this.$encoders.bson.unpack(done)
            this.result = done.result
            this.fct = done.fct

            this.$ws.socket.off('_bson:service:event:lambda:run:error', onError)
            this.$ws.socket.off('_bson:service:event:lambda:run:status', onStatus)
            this.handleSave(true)
          }

          let onStatus = fct => {
            fct = this.$encoders.bson.unpack(fct)
            this.fct = fct
            this.handleSave(true)
          }

          let onError = fct => {
            fct = this.$encoders.bson.unpack(fct)
            this.$ws.socket.off('_bson:service:event:lambda:run:done', onDone)
            this.$ws.socket.off('_bson:service:event:lambda:run:status', onStatus)
            this.fct = fct

            this.$services.emit('app:notification', this.$t('Failed to run function'))
            this.handleSave(true)
            console.log('run service ERROR', fct.err)
          }

          this.$ws.socket.once('_bson:service:event:lambda:run:done', onDone)
          this.$ws.socket.once('_bson:service:event:lambda:run:status', onStatus)
          this.$ws.socket.once('_bson:service:event:lambda:run:error', onError)
        }).catch(err => {
          this.fct.execution.status = 'error'
          this.fct.error = '' + err

          this.$services.emit('app:notification', this.$t('Failed to run function'))
          this.handleSave(true)
          console.log(err)
        })
      } else {
        console.log('image missing')
      }
    },
    handleClean() {
      if (this.fct.execution && this.fct.execution.container) {
        console.log('clean', $j(this.fct.execution))
        this.$services.lambda.clean(this.fct).then(() => {
          let onDone = fct => {
            fct = this.$encoders.bson.unpack(fct)
            this.fct = fct

            this.$ws.socket.off('_bson:service:event:lambda:clean:error', onError)
            this.handleSave(true)
          }

          let onError = fct => {
            fct = this.$encoders.bson.unpack(fct)
            this.$ws.socket.off('_bson:service:event:lambda:clean:done', onDone)
            this.fct = fct

            this.$services.emit('app:notification', this.$t('Failed to clean function'))
            console.log('clean service ERROR', fct.err)
            this.handleSave(true)
          }

          this.$ws.socket.once('_bson:service:event:lambda:clean:done', onDone)
          this.$ws.socket.once('_bson:service:event:lambda:clean:error', onError)
        }).catch(err => {
          this.fct.execution.status = 'error'
          this.fct.error = '' + err

          this.$services.emit('app:notification', this.$t('Failed to clean function'))
          this.handleSave(true)
          console.log(err)
        })
      } else {
        this.$services.emit('app:notification', this.$t('Failed to clean function'))
      }
    },
    handleBuildImage() {
      this.building = true

      this.$services.lambda.build(this.fct).then(() => {
        let onDone = fct => {
          fct = this.$encoders.bson.unpack(fct)
          console.log('image ' + fct.imageName + 'built')
          this.building = false
          this.$ws.socket.off('_bson:service:event:lambda:build:error', onError)
          this.fct = fct
          this.handleSave(true)
        }

        let onError = fct => {
          fct = this.$encoders.bson.unpack(fct)
          console.log('image build ERROR', fct.err)
          this.building = false
          this.fct = fct
          this.$ws.socket.off('_bson:service:event:lambda:build:done', onDone)
          this.handleSave(true)
        }

        this.$ws.socket.once('_bson:service:event:lambda:build:done', onDone)
        this.$ws.socket.once('_bson:service:event:lambda:build:error', onError)
      }).catch(err => {
        this.fct.execution = {
          container: null,
          status: 'error',
          error: '' + err
        }

        this.$services.emit('app:notification', this.$t('Failed to build image'))
        this.building = false
        this.handleSave(true)
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
    handleStatusProgess(which) {
      switch (which) {
        case 1:
          this.statusProgress = 1
          break
        case 2:
          this.statusProgress = 2
          break
        case 3:
          this.statusProgress = 3
          break
        case 4:
          this.statusProgress = 4
          break
        case 5:
          this.statusProgress = 5
          break
      }
    },
    computeStatus() {
      if (this.fct) {
        this.$services.waitForService('lambda').then(lambda => {
          lambda.isImageAvailable(this.fct).then(imageName => {
            this.fct.imageName = imageName

            if (this.fct.execution) {
              return this.fct.execution.status
            } else {
              this.fct.execution = {
                container: null,
                status: 'built'
              }
            }

            this.$forceUpdate()
            console.log('image', imageName)
          }).catch(err => {
            this.fct.imageName = null
            this.fct.execution = {
              container: null,
              status: 'undefined'
            }
            console.log('error', err)
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

      this.computeStatus()

      // vuetify issue with code tag
      setTimeout(() => {
        this.$forceUpdate()
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

.fct-row {
  display: flex;
  align-items: center;
  height: 32px;
  margin-bottom: 1px;
}

.fct-row--header {
  width: 30%;
  padding: 2px 8px;
  font-weight: bold;
  background-color: dodgerblue;
  color: white;
}

.fct-row--label {
  width: calc(70% - 64px);
  margin: 0 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
}
</style>
