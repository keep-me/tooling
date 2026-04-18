/* eslint-disable unicorn/no-process-exit */
process.env.NODE_ENV = 'development'

const chalk = require('chalk')
const net = require('net')
const webpack = require('webpack')
const getConfig = require('../lib')
const createServer = require('../lib/server')

function checkPort(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer()

    server.once('error', err => {
      if (err.code === 'EADDRINUSE') {
        resolve(false)
      } else {
        reject(err)
      }
    })

    server.once('listening', () => {
      server.close()
      resolve(true)
    })

    server.listen(port)
  })
}

function findAvailablePort(startPort, maxAttempts = 10) {
  return new Promise(async (resolve, reject) => {
    let port = startPort
    let attempts = 0

    while (attempts < maxAttempts) {
      const available = await checkPort(port)
      if (available) {
        resolve(port)
        return
      }
      console.log(chalk.yellow(`> Port ${port} is already in use, trying port ${port + 1}...`))
      port++
      attempts++
    }

    reject(new Error(`Could not find an available port after ${maxAttempts} attempts`))
  })
}

module.exports = async function (options) {
  const webpackConfig = getConfig(options)

  let compiler
  try {
    compiler = webpack(webpackConfig)
  } catch (err) {
    if (err.name === 'WebpackOptionsValidationError') {
      console.log(chalk.red(err.message))
    } else {
      console.error(err)
    }
    process.exit(1)
  }

  try {
    const port = await findAvailablePort(options.port || 4000)
    if (port !== options.port) {
      options.port = port
      console.log(chalk.green(`> Using available port ${port}`))
    } else {
      console.log(chalk.green(`> Port ${port} is available`))
    }
  } catch (err) {
    console.log(chalk.red(err.message))
    process.exit(1)
  }

  const {app} = createServer(compiler, options)

  app.listen(options.port)
}
