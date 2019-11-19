import Vue from 'vue'
import Lambda from '../src/components/Lambda.vue'

Vue.config.productionTip = false

new Vue({
  render: h => h(Lambda),
}).$mount('#app')
