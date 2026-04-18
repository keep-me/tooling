const path = require('path')
const fs = require('fs')
const webpack = require('webpack')
const NoEmitOnErrorsPlugin = require('webpack/lib/NoEmitOnErrorsPlugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const PostCompilePlugin = require('post-compile-webpack-plugin')
const ExtractTextPlugin = require('extract-text-webpack-plugin')

module.exports = function ({type, config, options}) {
  const isBuild = type === 'build'

  options = Object.assign({
    entry: 'index.js',
    dist: 'dist',
    html: {
      title: 'Tooling: Homepage',
      template: path.join(__dirname, 'template.html')
    },
    sourceMap: isBuild,
    minimize: isBuild,
    extract: isBuild,
    hash: isBuild,
    vendor: isBuild,
    typescript: undefined
  }, options)

  const filename = {
    js: options.hash ? '[name].[chunkhash:8].js' : '[name].js',
    css: options.hash ? '[name].[contenthash:8].css' : '[name].css'
  }

  const BABEL_OPTIONS = {
    babelrc: true,
    presets: [
      [require.resolve('babel-preset-latest'), {
        es2015: {modules: false}
      }]
    ]
  }

  const entryPath = path.resolve(options.entry)
  const entryDir = fs.existsSync(entryPath) 
    ? (fs.statSync(entryPath).isDirectory() ? entryPath : path.dirname(entryPath))
    : process.cwd()

  const tsConfigPath = findTsConfig(entryDir)
  const hasTsFiles = hasTypeScriptFiles(entryDir)
  const useTypeScript = Boolean(tsConfigPath) || hasTsFiles || options.typescript

  config
    .context(process.cwd())
    .devtool(isBuild ? 'source-map' : 'eval-source-map')
    .performance
      .set('hints', false)
      .end()
    .entry('web-client')
      .add(options.entry)
      .end()
    .output
      .path(path.resolve(options.dist))
      .publicPath('/')
      .filename(filename.js)
      .end()
    .resolve
      .extensions
        .add('.js')
        .add('.jsx')
        .add('.css')
        .add('.json')
        .end()
      .modules
        .add(process.cwd())
        .add(path.join(__dirname, 'node_modules'))
        .add(path.join(process.cwd(), 'node_modules'))
        .end()
      .end()
    .resolveLoader
      .modules
        .add(path.join(__dirname, 'node_modules'))
        .add(path.join(process.cwd(), 'node_modules'))
        .end()
      .end()
    .module
      .rule('web-compile-js')
        .test(/\.jsx?$/)
        .exclude([/node_modules/])
        .loader('babel', 'babel-loader')
        .end()
      .rule('web-compile-es6')
        .test(/\.es6$/)
        .loader('babel', 'babel-loader')
        .end()
      .end()
    .plugin('web-no-emit-on-errors')
      .use(NoEmitOnErrorsPlugin)
      .end()
    .plugin('web-Html')
      .use(HtmlWebpackPlugin, options.html)
      .end()
    .plugin('web-loader-options')
      .use(webpack.LoaderOptionsPlugin, {
        minimize: options.minimize,
        sourceMap: options.sourceMap,
        options: {
          context: process.cwd(),
          babel: BABEL_OPTIONS
        }
      })
      .end()
    .plugin('web-define')
      .use(webpack.DefinePlugin, {
        process: {
          env: {
            NODE_ENV: JSON.stringify(process.env.NODE_ENV)
          }
        }
      })

  if (useTypeScript) {
    applyTypeScriptSupport()
  }

  applyCSSLoaders()

  if (isBuild) {
    config
      .plugin('web-uglify')
        .use(webpack.optimize.UglifyJsPlugin, {
          /* eslint-disable camelcase */
          sourceMap: Boolean(options.sourceMap),
          compressor: {
            warnings: false,
            conditionals: true,
            unused: true,
            comparisons: true,
            sequences: true,
            dead_code: true,
            evaluate: true,
            if_return: true,
            join_vars: true,
            negate_iife: false
          },
          output: {
            comments: false
          }
          /* eslint-enable camelcase */
        })

    if (options.vendor) {
      config
        .plugin('web-commons-chunk-vendor')
          .use(webpack.optimize.CommonsChunkPlugin, {
            name: 'vendor',
            minChunks: module => {
              return module.resource && /\.(js|css|es6|ts|tsx)$/.test(module.resource) && module.resource.indexOf('node_modules') !== -1
            }
          })
          .end()
        .plugin('web-commons-chunk-manifest')
          .use(webpack.optimize.CommonsChunkPlugin, {
            name: 'manifest'
          })
          .end()
    }
  } else {
    config
      .entry('web-client')
        .prepend(path.join(__dirname, './dev-client.es6'))
        .end()
      .plugin('web-hmr')
        .use(webpack.HotModuleReplacementPlugin)
        .end()
  }

  function applyCSSLoaders() {
    const loaders = {
      css: 'postcss-loader',
      sass: 'sass-loader?indentedSyntax',
      scss: 'sass-loader',
      less: 'less-loader',
      stylus: 'stylus-loader',
      styl: 'stylus-loader'
    }

    for (const lang in loaders) {
      if (options.extract) {
        const extractPlugin = ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: ['css-loader', loaders[lang]]
        })
        config
          .module
            .rule(`web-compile-${lang}`)
              .test(new RegExp(`\\.${lang}$`))
              .loader('extract', extractPlugin[0].loader, extractPlugin[0].options)
              .loader('style', 'style-loader')
              .loader('css', 'css-loader')
              .loader(lang, loaders[lang])
              .end()
            .end()
          .plugin('web-extract-css')
            .use(ExtractTextPlugin, filename.css)
            .end()
      } else {
        config
          .module
            .rule(`web-compile-${lang}`)
              .test(new RegExp(`\\.${lang}$`))
              .loader('style', 'style-loader')
              .loader('css', 'css-loader')
              .loader(lang, loaders[lang])
              .end()
      }
    }
  }

  function parseTsConfigPaths(tsConfigPath) {
    try {
      const tsConfigContent = fs.readFileSync(tsConfigPath, 'utf-8')
      const tsConfig = JSON.parse(tsConfigContent)
      const compilerOptions = tsConfig.compilerOptions || {}
      const paths = compilerOptions.paths || {}
      const baseUrl = compilerOptions.baseUrl || '.'

      const tsConfigDir = path.dirname(tsConfigPath)
      const resolvedBaseUrl = path.resolve(tsConfigDir, baseUrl)

      const aliases = {}
      for (const [aliasPattern, targetPatterns] of Object.entries(paths)) {
        const aliasKey = aliasPattern.replace(/\/\*$/, '')
        for (const targetPattern of targetPatterns) {
          const targetPath = path.resolve(resolvedBaseUrl, targetPattern.replace(/\/\*$/, ''))
          aliases[aliasKey] = targetPath
        }
      }

      return aliases
    } catch (err) {
      return {}
    }
  }

  function applyTypeScriptSupport() {
    const chalk = require('chalk')
    console.log(chalk.bold('> TypeScript support enabled'))

    config.resolve.extensions
      .add('.ts')
      .add('.tsx')

    const tsLoaderOptions = {
      transpileOnly: !isBuild,
      happyPackMode: false
    }

    if (tsConfigPath) {
      tsLoaderOptions.configFile = tsConfigPath
      console.log(chalk.gray(`  Using tsconfig: ${tsConfigPath}`))
    } else {
      console.log(chalk.yellow('  Warning: No tsconfig.json found, using default TypeScript settings'))
    }

    config.module
      .rule('web-compile-typescript')
      .test(/\.tsx?$/)
      .exclude([/node_modules/])
      .loader('typescript', 'ts-loader', tsLoaderOptions)
      .end()

    if (tsConfigPath) {
      const tsConfigAliases = parseTsConfigPaths(tsConfigPath)
      if (Object.keys(tsConfigAliases).length > 0) {
        for (const [alias, targetPath] of Object.entries(tsConfigAliases)) {
          config.resolve.alias.set(alias, targetPath)
        }
        console.log(chalk.gray('  Path aliases enabled'))
      }

      try {
        const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin')
        config.resolve
          .plugin('tsconfig-paths')
          .use(TsconfigPathsPlugin, {configFile: tsConfigPath})
      } catch (err) {
      }
    }

    if (!isBuild && tsConfigPath && fs.existsSync(tsConfigPath)) {
      try {
        const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin')
        const forkTsCheckerOptions = {
          tsconfig: tsConfigPath,
          tslint: undefined,
          watch: [entryDir],
          async: true
        }
        config.plugin('fork-ts-checker')
          .use(ForkTsCheckerWebpackPlugin, forkTsCheckerOptions)
        console.log(chalk.gray('  Type checking enabled'))
      } catch (err) {
        console.log(chalk.yellow(`  Warning: Type checking disabled - ${err.message}`))
      }
    } else if (!isBuild) {
      console.log(chalk.yellow('  Type checking disabled (tsconfig.json not found)'))
    }
  }

  function findTsConfig(startDir) {
    const possiblePaths = [
      path.join(startDir, 'tsconfig.json'),
      path.join(startDir, 'src', 'tsconfig.json'),
      path.join(process.cwd(), 'tsconfig.json'),
      path.join(process.cwd(), 'src', 'tsconfig.json')
    ]
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p
      }
    }
    return null
  }

  function hasTypeScriptFiles(startDir) {
    const glob = require('glob')
    const patterns = ['**/*.ts', '**/*.tsx']
    const ignore = ['node_modules/**', 'dist/**']

    const searchDirs = [startDir, process.cwd()]

    for (const dir of searchDirs) {
      for (const pattern of patterns) {
        try {
          const matches = glob.sync(pattern, {
            cwd: dir,
            ignore,
            nodir: true
          })
          if (matches.length > 0) {
            return true
          }
        } catch (err) {
          continue
        }
      }
    }
    return false
  }
}
