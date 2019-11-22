const Gateway = require('@ignitial/iio-services').Gateway
const config = require('./config')
const fs = require('fs')
const path = require('path')
const os = require('os')
const _ = require('lodash')
const tar = require('tar')
const rimraf = require('rimraf')
const PluginManager = require('live-plugin-manager').PluginManager

class Lambda extends Gateway {
  constructor(options) {
    super(options)

    this._dependencies = []
    this._depsPath = path.join(__dirname, this._options.dependencies.path)
    this._plugins = new PluginManager()

    try {
      if (fs.existsSync(this._depsPath)) {
        this._dependencies = JSON.parse(fs.readFileSync(this._depsPath, 'utf8'))
      }
    } catch (err) {
      console.log('failed to load dependencies', err)
    }

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
  run(fctInfo) {
    /* @_POST_ */
    return new Promise(async (resolve, reject) => {
      let filepath
      try {
        for (let dep of fctInfo.dependencies) {
          global[dep.name] = await this._plugins.require(dep.name)
        }

        filepath = path.join(__dirname, './user', fctInfo.name + '.js')
        fs.writeFileSync(filepath, fctInfo.code, 'utf8')
        let fct = require(filepath)
        // remove from file system
        fs.unlinkSync(filepath)

        // fct must be a Promise
        fct(null, this).then(result => {
          resolve(result)
        }).catch(err => reject(err))
      } catch (err) {
        if (fs.existsSync(filepath)) {
          // remove from file system
          fs.unlinkSync(filepath)
        }
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
      try {
        let docker = await this. _waitForServiceAPI('docker')
        let basepath = path.join(os.homedir(), 'lambda')

        if (!fs.existsSync(basepath)) {
          fs.mkdirSync(basepath)
        }

        if (!fs.existsSync(path.join(basepath, 'src'))) {
          fs.mkdirSync(path.join(basepath, 'src'))
        }

        if (!fct.archive) {
          let filepath = path.join(basepath, 'src', fct.name + '.js')
          fs.writeFileSync(filepath, fct.code, 'utf8')
        }

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

        let archivePath = path.join(basepath, fct.name + '.tar')

        let files = fs.readdirSync(path.join(basepath, 'src'))

        // files = _.map(files, e => path.join(path.join(basepath, 'src'), e))

        await tar.c({
          C: path.join(path.join(basepath, 'src')),
          /*gzip: true,*/
          file: archivePath
        }, files)

        let archiveBuf = fs.readFileSync(archivePath)
        // taking in account current registry managed by docker service
        let imageName = await docker.buildFromRawDataArchive({
          data: archiveBuf.toString('binary'),
          name: fct.name,
          folder: path.join(basepath, 'src')
        }, {
          $userId: null,
          $privileged: true
        })

        // pushing to related registry
        await docker.pushImageByName(imageName, {
          $userId: null,
          $privileged: true
        })

        rimraf.sync(basepath)

        resolve(imageName)
      } catch (err) {
        reject(err)
      }
    })
  }

  // (private) install given dependency for a given runtime
  // ***************************************************************************
  _installDependency(runtime, libName, libVersion) {
    console.log(runtime, libName, libVersion)
    return new Promise(async (resolve, reject) => {
      let found = _.find(this._dependencies,
        e => e.name === libName && e.runtime === runtime && (libVersion ? libVersion === e.version : true))

      if (!found && runtime.match(/Node/)) {
        await this._plugins.install(libName, libVersion).then(() => {
          try {
            this._dependencies.push({
              name: libName,
              version: libVersion,
              runtime: runtime
            })

            fs.writeFileSync(this._depsPath, JSON.stringify(this._dependencies, null, 2))
            resolve()
          } catch (err) {
            reject(err)
          }
        }).catch(err => {
          reject(err)
        })
      } else if (found) {
        resolve()
      } else {
        reject('runtime mismatch')
      }
    })
  }

  // install dependency for a function
  // ***************************************************************************
  installDependencies(fct) {
    /* @_POST_ */
    return new Promise(async (resolve, reject) => {
      try {
        for (let dep of fct.dependencies) {
          await this._installDependency(fct.runtime, dep.name, dep.version)
        }

        resolve(this._dependencies)
      } catch (err) {
        reject(err)
      }
    })
  }

  // get installed dependencies
  // ***************************************************************************
  installedDependencies() {
    /* @_GET_ */
    return new Promise(async (resolve, reject) => {
      resolve(this._dependencies)
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
