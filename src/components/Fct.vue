<template>
  <div v-if="fct" class="fct-layout">
    <v-text-field :label="$t('Name') + '*'" v-model="fct.name" required
      style="max-width: 200px;"
      :items="runtimes"></v-text-field>

    <v-text-field :label="$t('Description')" v-model="fct.description"></v-text-field>

    <v-select :label="$t('Runtime') + '*'" required
      style="max-width: 200px;"
      :items="runtimes" v-model="fct.runtime"></v-select>

    <div class="fct-section">{{ $t('Source code') }}*</div>

    <prism-editor ref="editor" lineNumbers class="fct-editor"
      :code="fct.code" @change="handleChange" language="js"></prism-editor>

    <div class="fct-menu">
      <v-btn icon text color="blue darken-1" @click="handleSave"
        :disabled="!modified">
        <v-icon>save</v-icon>
      </v-btn>
    </div>
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
      modified: false
    }
  },
  watch: {
    fct: {
      handler: function(val) {
        if (this.lastFct && this.lastFct !== JSON.stringify(this.fct)) {
          this.modified = true
        }
      },
      deep: true
    }
  },
  computed: {

  },
  methods: {
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
      } catch (err) {
        console.log(err)
        this.$services.emit('app:notification', this.$t('Modificaiton failed'))
      }
    },
    updateCss() {
      if (this.$refs.editor) {
        let code = this.$refs.editor.$el.getElementsByTagName('code')[0]
        code.style.boxShadow = 'none'
      }
    },
    handleChange(val) {
      this.fct.code = val
      this.$emit('update:data', this.fct)

      // vuetify issue with code tag
      setTimeout(() => {
        this.updateCss()
      }, 200)
    }
  },
  mounted() {
    this.fct = _.cloneDeep(this.data)
    this.lastFct = JSON.stringify(this.fct)

    if (!this.fct.code) {
      this.$services.lambda.template().then(code => {
        this.fct.code = code
        this.$emit('update:data', this.fct)
      }).catch(err => console.log(err))
    }

    // vuetify issue with code tag
    setTimeout(() => {
      this.updateCss()
    }, 200)
  },
  beforeDestroy() {

  }
}
</script>

<style scoped>
.fct-layout {
  width: 100%;
  height: calc(100% - 0px);
  position: relative;
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
  color: dodgerblue;
}

.fct-menu {
  position: absolute;
  bottom: 16px;
  right: 16px;
}
</style>
