const fs = require('fs')
const path = require('path')
const YAML = require('yaml')

function envBrowseAndReplace(config) {
  for (let prop in config) {
    if (typeof config[prop] !== 'string' && typeof config[prop] !== 'number') {
      config[prop] = envBrowseAndReplace(config[prop])
    } else {
      if (typeof config[prop] === 'string') {
        let envVarMatch = config[prop].match(/env\((.*?)\)/)
        if (envVarMatch) {
          config[prop] = process.env[envVarMatch[1]]
        }
      }
    }
  }

  return config
}

let generatedConfigPath = path.join(process.cwd(), 'server', 'config', 'generated', 'config.json')
if (fs.existsSync(generatedConfigPath)) {
  let config = JSON.parse(fs.readFileSync(generatedConfigPath, 'utf8'))
  config = envBrowseAndReplace(config)
  console.log('WARNING: using YAML configuration')
  module.exports = config
  return
}

console.log('WARNING: generated file [' + generatedConfigPath + '] does not exist. switch to env config')

// REDIS configuration
// -----------------------------------------------------------------------------
const IIOS_REDIS_PORT = process.env.IIOS_REDIS_PORT ? parseInt(process.env.IIOS_REDIS_PORT) : 6379
const IIOS_REDIS_DB = process.env.IIOS_REDIS_DB ? parseInt(process.env.IIOS_REDIS_DB) : 0
const IIOS_REDIS_ACCESSDB = process.env.IIOS_REDIS_ACCESSDB || 1
let IIOS_REDIS_SENTINELS

if (process.env.IIOS_REDIS_SENTINELS) {
  IIOS_REDIS_SENTINELS = []
  let sentinels = process.env.IIOS_REDIS_SENTINELS.split(',')
  for (let s of sentinels) {
    IIOS_REDIS_SENTINELS.push({ host: s.split(':')[0], port: s.split(':')[1] })
  }
}

// Main configuration structure
// -----------------------------------------------------------------------------
module.exports = {
  /* service name */
  name: process.env.IIOS_SERVICE_NAME || 'lambda',
  /* service namesapce */
  namespace: process.env.IIOS_NAMESPACE || 'ignitialio',
  /* heartbeat */
  heartbeatPeriod: 5000,
  /* PUB/SUB/KV connector */
  connector: {
    /* redis server connection */
    redis: {
      /* encoder to be used for packing/unpacking raw messages */
      encoder: process.env.IIOS_ENCODER || 'bson',
      master: process.env.IIOS_REDIS_MASTER || 'mymaster',
      sentinels: IIOS_REDIS_SENTINELS,
      host: process.env.IIOS_REDIS_HOST,
      port: IIOS_REDIS_PORT,
      db: IIOS_REDIS_DB
    },
  },
  /* provide data service name */
  data: {
    service: 'dlake'
  },
  /* access control: if present, acces control enabled */
  accesscontrol: {
    /* access control namespace */
    namespace: process.env.IIOS_NAMESPACE || 'ignitialio',
    /* grants for current service: auto-fill */
    grants: {
      admin: {
        'create:any': [ '*' ],
        'read:any': [ '*' ],
        'update:any': [ '*' ],
        'delete:any': [ '*' ]
      },
      user: {
        'read:any': [ '*' ],
        'update:any': [ '*' ],
        'delete:any': [ '*' ]
      },
      anonymous: {
        'read:any': [ '*' ]
      }
    },
    /* connector configuration: optional, default same as global connector, but
       on DB 1 */
    connector: {
      /* redis server connection */
      redis: {
        encoder: process.env.IIOS_ENCODER || 'bson',
        master: process.env.IIOS_REDIS_MASTER || 'mymaster',
        sentinels: IIOS_REDIS_SENTINELS,
        host: process.env.IIOS_REDIS_HOST,
        port: IIOS_REDIS_PORT,
        db: IIOS_REDIS_ACCESSDB
      }
    }
  },
  /* orchestrator: Docker, Docker Swarm, Kubernetes */
  orchestrator: 'Docker',
  /* docker service configuration */
  docker: {
    host: process.env.IIOS_DOCKER_HOST || 'docker',
    port: process.env.IIOS_DOCKER_PORT || 20513,
    registry: process.env.IIOS_DOCKER_REGISTRY || 'registry'
  },
  /* HTTP server declaration */
  server: {
    /* server host */
    host: process.env.IIOS_SERVER_HOST,
    /* server port */
    port: process.env.IIOS_SERVER_PORT,
    /* path to statically serve (at least one asset for icons for example) */
    path: process.env.IIOS_SERVER_PATH_TO_SERVE || './dist',
    /* indicates that service is behind an HTTPS proxy */
    https: false,
  },
  /* options published through discovery mechanism */
  publicOptions: {
    /* declares component injection */
    uiComponentInjection: true,
    /* service description */
    description: {
      /* service icon */
      icon: 'assets/lambda-64.png',
      /* Internationalization: see Ignitial.io Web App */
      i18n: {
        'My amazing component': [ 'Mon super composant' ],
        'Provides uber crazy services':  [
          'Fournit des services super hyper dingues'
        ],
        'Insert here your own UI components': [
          'Insérer ici vos propres composants'
        ],
        'Lambda Service view': [
          'Vue du service Lambda'
        ],
        'Source code': [
          'Code source'
        ],
        'Result': [
          'Résultat'
        ],
        'Name': [
          'Nom'
        ],
        'Dependencies': [
          'Dépendances'
        ],
        'Failed to build image': [
          'Échec de la construction de l\'image'
        ],
        'No associated image available': [
          'Pas d\'image associée disponible'
        ],
        'Docker image': [
          'Image docker'
        ],
        'Failed to run function': [
          'Échec de l\'exécution de la fonction'
        ],
        'Execution status': [
          'État de l\'exécution'
        ],
        'Status': [
          'État'
        ],
        'No associated container': [
          'Pas de conteneur associé'
        ],
        'Failed to activate function': [
          'Échec de l\'activation de la fonction'
        ],
        'Failed to clean function': [
          'Échec du nettoyage de la fonction'
        ]
      },
      /* eventually any other data */
      title: 'My amazing component',
      info: 'Provides uber crazy services'
    },
    /* domain related public options: could be any JSON object*/
    myPublicOption: {
      someOptions: {}
    }
  }
}
