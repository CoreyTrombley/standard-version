const accessSync = require('fs-access').sync
const chalk = require('chalk')
const checkpoint = require('../checkpoint')
const conventionalChangelog = require('conventional-changelog')
const fs = require('fs')
const presetLoader = require('../preset-loader')
const runLifecycleScript = require('../run-lifecycle-script')
const writeFile = require('../write-file')

// This needs to be refactored to accept any pattern
// for now I have hardcoded the pattern we need
//const START_OF_LAST_RELEASE_PATTERN = /(^#+ \[?[0-9]+.[0-9]+.[0-9]\]?|\[?R[0-9]+\.?[0-9]?\]?|<a name=)/m

function Changelog (args, newVersion) {
  if (args.skip.changelog) return Promise.resolve()
  return runLifecycleScript(args, 'prechangelog')
    .then(() => {
      return outputChangelog(args, newVersion)
    })
    .then(() => {
      return runLifecycleScript(args, 'postchangelog')
    })
}

module.exports = Changelog

function outputChangelog (args, newVersion) {
  return new Promise((resolve, reject) => {
    createIfMissing(args)
    const header = args.header

    let oldContent = fs.readFileSync(args.infile, 'utf-8')
    const re = new RegExp(`(${args.startOfLastReleaseRegex})`)

    console.log('RegEx', re)
    const startIdx = oldContent.search(re)

    console.log('Changelog content start index', startIdx)
    // find the position of the last release and remove header:
    if (startIdx > -1) {
      oldContent = oldContent.substring(startIdx)
    }

    let content = ''
    const context = { version: newVersion }
    const changelogStream = conventionalChangelog({
      debug: args.verbose && console.info.bind(console, 'conventional-changelog'),
      preset: presetLoader(args),
      tagPrefix: args.tagPrefix
    }, context, { merges: null, path: args.path })
      .on('error', function (err) {
        return reject(err)
      })

    changelogStream.on('data', function (buffer) {
      content += buffer.toString()
    })

    changelogStream.on('end', function () {
      checkpoint(args, 'outputting changes to %s', [args.infile])
      if (args.dryRun) console.info(`\n---\n${chalk.gray(content.trim())}\n---\n`)
      else writeFile(args, args.infile, header + '---\n\n' + (content + oldContent).replace(/\n+$/, '\n'))
      return resolve()
    })
  })
}

function createIfMissing (args) {
  try {
    accessSync(args.infile, fs.F_OK)
  } catch (err) {
    if (err.code === 'ENOENT') {
      checkpoint(args, 'created %s', [args.infile])
      args.outputUnreleased = true
      writeFile(args, args.infile, '\n')
    }
  }
}
