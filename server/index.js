const Gateway = require('@ignitial/iio-services').Gateway
const config = require('./config')
const fs = require('fs')
const path = require('path')
const os = require('os')
const _ = require('lodash')
const tar = require('tar')
const rimraf = require('rimraf')

class Lambda extends Gateway {
  constructor(options) {
    super(options)

    // manage long delay for reponse (ex: image build)
    this._options.timeout = 86000000

    this._waitForServiceAPI(this._options.data.service).then(async dataService => {
      try {
        await dataService.addDatum('lambdafcts', {
          grants: {
            $privileged: {
              'dlake:lambdafcts': {
                'create:any': [ '*' ],
                'read:any': [ '*' ],
                'update:any': [ '*' ],
                'delete:any': [ '*' ]
              }
            },
            admin: {
              'dlake:lambdafcts': {
                'create:any': [ '*' ],
                'read:any': [ '*' ],
                'update:any': [ '*' ],
                'delete:any': [ '*' ]
              }
            },
            user: {
              'dlake:lambdafcts': {
                'create:any': [ '*' ],
                'read:any': [ '*' ],
                'update:any': [ '*' ],
                'delete:any': [ '*' ]
              }
            },
            anonymous: {
              'dlake:lambdafcts': {
                'read:any': [ '*' ]
              }
            }
          }
        }, {
          $privileged: true,
          $userId: null
        })
      } catch (err) {
        if (!('' + err).match('datum already defined')) {
          console.log(err, 'failed to add datum')
        }
      }
    }).catch(err => {
      console.log(err, 'failed to add datum')
    })
  }

  // starts related container for an user function
  // ***************************************************************************
  activate(fct) {
    /* @_POST_ */
    return new Promise(async (resolve, reject) => {
      // fake answer to manage timeouts: response replaced with events
      resolve({
        _events: {
          done: 'service:event:lambda:activate:done',
          err: 'service:event:lambda:activate:error'
        }
      })

      try {
        switch (this._options.orchestrator) {
          case 'Docker Swarm':
            break
          case 'Kubernetes':
            break
          case 'Docker':
          default:
            let docker = await this. _waitForServiceAPI('docker')

            docker.runService(fct.imageName, {
              Env: [
                'IIOS_SERVICE_NAME=' + fct.name.toLowerCase(),
                'IIOS_SERVER_HOST=' + fct.name.toLowerCase(),
                'IIOS_SERVER_PORT=20099',
                'IIOS_NAMESPACE=' + this._options.namespace,
                'IIOS_REDIS_HOST=' + this._options.connector.redis.host,
                'IIOS_REDIS_PORT=' + this._options.connector.redis.port
              ],
              HostConfig: {
                /* to be implemented as service configuration */
                NetworkMode: 'infra'
              }
            }, {
              $userId: null,
              $privileged: true
            }).then(async containerId => {
              fct.execution = {
                container: containerId,
                status: 'activated'
              }

              // use bson encoder
              this._pushEvent(this._options.name + ':activate:done', fct)
            }).catch(err => {
              fct.execution.status = 'error'
              fct.execution.error = '' + err

              // use bson encoder
              this._pushEvent(this._options.name + ':activate:error', fct)
              console.log(err)
            })
        }
      } catch (err) {
        fct.execution.status = 'error'
        fct.execution.error = '' + err

        // use bson encoder
        this._pushEvent(this._options.name + ':activate:error', fct)
        console.log(err)
      }
    })
  }

  // executes an user function from its associated container
  // ***************************************************************************
  run(fct) {
    /* @_POST_ */
    return new Promise(async (resolve, reject) => {
      // fake answer to manage timeouts: response replaced with events
      resolve({
        _events: {
          done: 'service:event:lambda:run:done',
          status: 'service:event:lambda:run:status',
          err: 'service:event:lambda:run:error'
        }
      })

      try {
        switch (this._options.orchestrator) {
          case 'Docker Swarm':
            break
          case 'Kubernetes':
            break
          case 'Docker':
          default:
            let fctService = await this._waitForServiceAPI(fct.name.toLowerCase(), 10000)

            fct.execution.status = 'running'

            // use bson encoder
            this._pushEvent(this._options.name + ':run:status', fct)

            fctService.fct({
              $userId: null,
              $privileged: true
            }).then(async result => {
              fct.execution.status = 'stopped'

              // use bson encoder
              this._pushEvent(this._options.name + ':run:done', {
                result: result,
                fct: fct
              })
            }).catch(async err => {
              fct.execution.status = 'error'
              fct.execution.error = '' + err

              // use bson encoder
              this._pushEvent(this._options.name + ':run:error', fct)

              console.log(err)
            })
        }
      } catch (err) {
        fct.execution.status = 'error'
        fct.execution.error = '' + err

        // use bson encoder
        this._pushEvent(this._options.name + ':run:error', fct)
        console.log(err)
      }
    })
  }

  // clean user function removing associated container
  // ***************************************************************************
  clean(fct) {
    /* @_POST_ */
    return new Promise(async (resolve, reject) => {
      // fake answer to manage timeouts: response replaced with events
      resolve({
        _events: {
          done: 'service:event:lambda:clean:done',
          err: 'service:event:lambda:clean:error'
        }
      })

      try {
        switch (this._options.orchestrator) {
          case 'Docker Swarm':
            break
          case 'Kubernetes':
            break
          case 'Docker':
          default:
            let docker = await this. _waitForServiceAPI('docker')

            await docker.stopContainer(fct.execution.container, true, {
              $userId: null,
              $privileged: true
            }) // remove as well

            fct.execution.container = null
            fct.execution.status = 'built'

            // use bson encoder
            this._pushEvent(this._options.name + ':clean:done', fct)
        }
      } catch (err) {
        fct.execution.status = 'error'
        fct.execution.error = '' + err

        // use bson encoder
        this._pushEvent(this._options.name + ':clean:error', fct)
        console.log(err)
      }
    })
  }

  // executes an user function providing its source code
  // ***************************************************************************
  template() {
    /* @_GET_ */
    return new Promise((resolve, reject) => {
      try {
        let srcCode = fs.readFileSync(path.join(__dirname, 'template.js'), 'utf8')
        resolve(srcCode)
      } catch (err) {
        reject(err)
      }
    })
  }

  // builds fct related Docker image for stateless implementation
  // ***************************************************************************
  build(fct) {
    /* @_POST_ */
    return new Promise(async (resolve, reject) => {
      // fake answer to manage timeouts: response replaced with events
      resolve({
        _events: {
          done: 'service:event:lambda:build:done',
          err: 'service:event:lambda:build:error'
        }
      })

      try {
        let docker = await this. _waitForServiceAPI('docker')
        let staticPath = path.join(process.cwd(), this._options.server.path)
        let basepath = path.join(staticPath, 'build')

        if (!fs.existsSync(basepath)) {
          fs.mkdirSync(basepath)
        }

        if (!fs.existsSync(path.join(basepath, 'src'))) {
          fs.mkdirSync(path.join(basepath, 'src'))
        }

        if (!fct.archive) {
          let filepath = path.join(basepath, 'src', 'index.js')
          fs.writeFileSync(filepath, fct.code, 'utf8')
        } else {

        }

        // taking in account current configured registry
        let imageName = this._options.docker.registry + '/' +
          fct.name.toLowerCase() + (fct.version ? ':' + fct.version : '')

        let dockerfileTemplatePath = path.join(__dirname, './data', 'Dockerfile.template')
        let dockerfile = fs.readFileSync(dockerfileTemplatePath, 'utf8')

        if (fct.dependencies && fct.dependencies.length > 0) {
          let deps = _.map(fct.dependencies, e => e.name)
          dockerfile = dockerfile.replace(/_DEPENDENCIES_/, deps.join(' '))
        } else {
          dockerfile = dockerfile.replace('npm install _DEPENDENCIES_', '')
        }

        let dockerfilePath = path.join(basepath, 'src', 'Dockerfile')
        fs.writeFileSync(dockerfilePath, dockerfile, 'utf8')

        let filename = fct.name + '.tgz'
        let archivePath = path.join(basepath, filename)

        let files = fs.readdirSync(path.join(basepath, 'src'))

        await tar.c({
          C: path.join(path.join(basepath, 'src')),
          gzip: true,
          file: archivePath
        }, files)

        let url = 'http://' +
          (process.env.IIOS_SERVER_HOST_TEST ?
            process.env.IIOS_SERVER_HOST_TEST : this._options.server.host) + ':' +
          this._options.server.port + '/build/' + filename

        docker.buildFromRemote({
          remote: url,
          t:  imageName
        }, {
          $userId: null,
          $privileged: true
        }).then(result => {
          try {
            rimraf.sync(basepath + '/*')
          } catch (err) {

            // use bson encoder
            fct.execution = {
              container: null,
              status: 'error',
              error: '' + err
            }

            this._pushEvent(this._options.name + ':build:error', fct)
            // instead of reject(err)
            return
          }

          // pushing to related registry
          docker.pushImageByName(imageName, {
            $userId: null,
            $privileged: true
          }).then(() => {
            fct.imageName = imageName
            fct.execution = {
              container: null,
              status: 'built'
            }

            // use bson encoder
            this._pushEvent(this._options.name + ':build:done', fct)
          }).catch(err => {
            fct.execution = {
              container: null,
              status: 'error',
              error: '' + err
            }

            // use bson encoder
            this._pushEvent(this._options.name + ':build:error', fct)
            // instead of reject(err)

            rimraf.sync(basepath + '/*')
            console.log(err)
          })
        }).catch(err => {
          fct.execution = {
            container: null,
            status: 'error',
            error: '' + err
          }

          // use bson encoder
          this._pushEvent(this._options.name + ':build:error', fct)

          // instead of reject(err)
          rimraf.sync(basepath + '/*')
          console.log(err)
        })
      } catch (err) {
        fct.execution = {
          container: null,
          status: 'error',
          error: '' + err
        }

        // use bson encoder
        this._pushEvent(this._options.name + ':build:error', fct)
        // instead of reject(err)
      }
    })
  }

  // check if image is available
  // ***************************************************************************
  isImageAvailable(fct) {
    /* @_GET_ */
    return new Promise(async (resolve, reject) => {
      let docker = await this. _waitForServiceAPI('docker')
      // taking in account current configured registry
      let imageName = this._options.docker.registry + '/' +
        fct.name.toLowerCase() + (fct.version ? ':' + fct.version : '')

      docker.isImageAvailable(imageName, {
        $userId: null,
        $privileged: true
      }).then(() => {
        resolve(imageName)
      }).catch(err => reject(err))
    })
  }
}

// instantiate service with its configuration
const lambda = new Lambda(config)

lambda._init().then(() => {
  console.log('service [' + lambda.name + '] initialization done with options ',
    lambda._options)
}).catch(err => {
  console.error('initialization failed', err)
  process.exit(1)
})
