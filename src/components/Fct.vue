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
    <div v-else>{{ $t('No associated image available') }}</div>

    <div class="fct-section">
      {{ $t('Dependencies') }}
      <v-btn color="blue darken-1" icon text
        @click="handleApplyDeps" :disabled="!hasDeps(fct)" dark>
        <v-icon>play_for_work</v-icon>
      </v-btn>
    </div>

    <div class="fct-dependencies">
      <div class="fct-lib" v-for="dep of fct.dependencies" :key="dep.name">
        <span style="margin-right: 32px;">
          {{ dep.name + ( dep.version ? '@' + dep.version : '') }}</span>
        <v-icon class="fct-lib--status" v-show="!isInstalled(dep.name)" color="grey">error</v-icon>
        <v-icon class="fct-lib--status" v-show="isInstalled(dep.name)" color="green lighten-1">done</v-icon>
      </div>
    </div>

    <div class="fct-section">{{ $t('Source code') }}*</div>

    <prism-editor ref="editor" lineNumbers class="fct-editor"
      :code="fct.code" @change="handleChange" language="js"></prism-editor>

    <div class="fct-section">
      {{ $t('Test') }}
      <v-btn color="blue darken-1" icon text
        @click="handleRun" :disable="running" dark>
        <v-icon>play_arrow</v-icon>
      </v-btn>
    </div>

    <v-textarea style="margin-top: 16px"
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
        if (JSON.stringify(val) !== JSON.stringify(this.fct)) {
          this.fct = cloneDeep(val)
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
      this.$services.lambda.run(this.fct).then(result => {
        this.result = result
        this.running = false
      }).catch(err => {
        this.result = err
        this.running = false
      })
    },
    handleBuildImage() {
      this.building = true

      this.$services.lambda.build(this.fct).then(() => {
        this.building = false
      }).catch(err => {
        this.$services.emit('app:notification', this.$t('Failed to build image'))
        this.building = false
        console.log(err)
      })
    },
    handleApplyDeps() {
      this.$services.lambda.installDependencies(this.fct).then(result => {
        this._installedDeps = result
        this.$forceUpdate()
      }).catch(err => {
        this.$services.emit('app:notification', this.$t('Failed to install dependencies'))
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
    isInstalled(depName) {
      let found
      for (let dep of this._installedDeps) {
        if (dep.name === depName) return true
      }

      return false
    },
    hasDeps(fct) {
      if (fct.dependencies && fct.dependencies.length) {
        return true
      }
      return false
    }
  },
  mounted() {
    this.$services.lambda.installedDependencies().then(result => {
      this._installedDeps = result
    }).catch(err => console.log(err))

    this._listeners = {
      onSave: this.handleSave.bind(this),
      onNew: this.handleNew.bind(this)
    }

    this.$services.on('view:lambda:new', this._listeners.onNew)
    this.$services.on('view:lambda:save', this._listeners.onSave)

    if (this.data.name) {
      this.fct = cloneDeep(this.data)
      this.lastFct = JSON.stringify(this.fct)

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

.fct-dependencies {
  display: flex;
  flex-wrap: wrap;
  min-height: 48px;
  align-items: flex-start;
  justify-content: flex-start;
}

.fct-lib {
  background-color: navajowhite;
  border-radius: 12px;
  height: 24px;
  padding: 0 12px;
  margin: 0 4px;
  position: relative;
}

.fct-lib--status {
  position: absolute;
  right: 0;
  top: 0;
}
</style>
