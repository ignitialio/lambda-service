import Lambda from './components/Lambda.vue'

// function to be called when service loaded into web app:
// naming rule: iios_<service_unique_name>
//
global.iios_lambda = function(Vue) {
  // Warning: component name must be globally unique in your host app
  Vue.component('lambda', Lambda)

  let register = () => {
    // EXEAMPLE
    Vue.prototype.$services.emit('app:menu:add', [
      {
        path: '/service-lambda',
        title: 'Lambda Service view',
        svgIcon: '$$service(lambda)/assets/lambda.svg',
        section: 'Services',
        anonymousAccess: true,
        hideIfLogged: false,
        route: {
          name: 'Lambda',
          path: '/service-lambda',
          component: Lambda
        }
      }
    ])

    let onServiceDestroy = () => {
      Vue.prototype.$services.emit('app:menu:remove', [{
        path: '/service-lambda'
      }])

      Vue.prototype.$services.emit('service:destroy:lambda:done')
    }

    Vue.prototype.$services.once('service:destroy:lambda', onServiceDestroy)
  }

  if (Vue.prototype.$services.appReady) {
    register()
  } else {
    Vue.prototype.$services.once('app:ready', register)
  }
}
