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

  // executes an user function providing its source code
  // ***************************************************************************
  run(fct) {
    /* @_POST_ */
    return new Promise(async (resolve, reject) => {
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
              $userId: null,
              $privileged: true
            }).then(containerId => {
              console.log(containerId)
              fct.running = {
                container: containerId,
                status: 'running'
              }

              resolve(fct)
            }).catch(err => {
              reject(err)
            })
        }
      } catch (err) {
        console.log(err)
        reject(err)
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

        let archiveBuf = fs.readFileSync(archivePath)
        let url = 'http://' + this._options.server.host + ':' +
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
            this._pushEvent(this._options.name + ':build:error', '' + err)
            // instead of reject(err)
            return
          }

          // pushing to related registry
          docker.pushImageByName(imageName, {
            $userId: null,
            $privileged: true
          }).then(() => {
            this._pushEvent(this._options.name + ':build:done', imageName)
          }).catch(err => {
            this._pushEvent(this._options.name + ':build:error', '' + err)
            // instead of reject(err)
            rimraf.sync(basepath + '/*')
            console.log(err)
          })
        }).catch(err => {
          this._pushEvent(this._options.name + ':build:error', '' + err)
          // instead of reject(err)
          rimraf.sync(basepath + '/*')
          console.log(err)
        })
      } catch (err) {
        this._pushEvent(this._options.name + ':build:error', '' + err)
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

      console.log(fct, imageName)

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
