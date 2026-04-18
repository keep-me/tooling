/* eslint-disable import/no-dynamic-require */

const chalk = require('chalk')
const config = require('conpack')
const PostCompilePlugin = require('post-compile-webpack-plugin')
const path = require('path')
const fs = require('fs')
const _ = require('./utils')

module.exports = function (options) {
  const presets = (options.presets || []).map(preset => {
    if (!Array.isArray(preset)) {
      return [preset, null]
    }
    return preset
  })

  for (const [name, presetOptions] of presets) {
    loadPreset(name, presetOptions)
    console.log(chalk.bold(`> Using preset \`${name}\``))
  }

  config
    .plugin('tooling-PostCompile')
      .use(PostCompilePlugin, stats => {
        process.stdout.write('\x1Bc')
        if (stats.hasErrors() && options.type === 'build') {
          throw new Error(stats.toString('errors-only'))
        }
        console.log(stats.toString({
          children: false,
          modules: false,
          colors: true,
          chunks: false
        }))
        if (options.type === 'dev') {
          console.log(chalk.bold(`\n> Open http://localhost:${options.port}\n`))
        }
      })

  console.log()

  return config.toConfig()

  function findPresetPath(name) {
    const presetName = `tooling-preset-${name}`
    const possiblePaths = [
      _.cwd('node_modules', presetName),
      path.resolve(__dirname, '../../', presetName),
      path.resolve(process.cwd(), 'packages', presetName)
    ]

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        const pkgPath = path.join(p, 'package.json')
        if (fs.existsSync(pkgPath)) {
          return p
        }
        const indexPath = path.join(p, 'index.js')
        if (fs.existsSync(indexPath)) {
          return indexPath
        }
      }
    }

    return null
  }

  function loadPreset(name, presetOptions) {
    const context = {
      config,
      type: options.type,
      options: presetOptions,
      inherit: loadPreset
    }

    const presetPath = findPresetPath(name)
    if (presetPath) {
      require(presetPath)(context)
    } else {
      try {
        require(_.cwd('node_modules', `tooling-preset-${name}`))(context)
      } catch (err) {
        console.error(chalk.red(`Error loading preset '${name}': ${err.message}`))
        throw err
      }
    }
  }
}
