#!/usr/bin/env node

'use strict'

const Promise = require('bluebird')
const logSymbols = require('log-symbols')
const PlexAPI = require('plex-api')
const JSONPath = require('JSONPath')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const humanize = require('humanize')
const chalk = require('chalk')
const elegantSpinner = require('elegant-spinner')
const logUpdate = require('log-update')
const frame = elegantSpinner()
const os = require('os')
const CONFIG_PATH = os.homedir() + '/.plex-tv-cleanup-config'

try {
  var config = require(CONFIG_PATH)
} catch (e) {
  console.error(logSymbols.error, 'Please create', chalk.green(CONFIG_PATH + '.json'), 'with your configuration. See https://github.com/hyperlink/plex-tv-cleanup/blob/master/README.md#installation')
  process.exit(1)
}

if (config.plex.homeUser) {
  console.warn(`${logSymbols.warning} homeUser has been renamed to managedUser please update your config.`)
  config.plex.managedUser = config.plex.homeUser
}

const dnd = config.dnd
const client = new PlexAPI(config.plex)

let spinnerIntervalId = null

function startSpinner () {
  spinnerIntervalId = setInterval(() => logUpdate(frame()), 50)
}

function stopSpinner () {
  clearInterval(spinnerIntervalId)
  logUpdate('')
}

const dryRun = process.argv.slice(2).some(arg => arg === '--dry-run')

Promise.coroutine(function* () {
  if (dryRun) {
    console.log(logSymbols.info, 'Dry Run')
  }

  const tvSections = yield client.find('/library/sections', {type: 'show'})

  if (tvSections.length > 1) {
    throw new Error('Multiple TV sections found.')
  }

  if (tvSections.length === 0) {
    throw new Error('No TV sections were found.')
  }

  const televisionSection = tvSections[0].uri
  console.log(`TV URI : ${televisionSection}`)

  const allShows = path.join(televisionSection, 'allLeaves')

  const viewed = ep => ep.viewCount

  const allEpisodes = yield client.find(allShows)
  const viewedEpisodes = allEpisodes.filter(viewed)

  const filesToDelete = JSONPath({json: viewedEpisodes, path: '$..file', resultType: 'parent'}).filter(ep => !ignore(ep.file))

  filesToDelete.forEach(ep => console.log(' %s %s | %s', logSymbols.info, path.basename(ep.file), chalk.green(humanize.filesize(ep.size))))

  const totalBytes = filesToDelete.reduce((prev, ep) => prev + ep.size, 0)
  const totalEpisodes = filesToDelete.length

  startSpinner()

  if (!dryRun) {
    try {
      yield Promise.map(filesToDelete, ep => fs.unlinkAsync(decodeURIComponent(ep.file)), {concurrency: 10})
      // yield Promise.all(filesToDelete.map(ep => fs.unlinkAsync(decodeURIComponent(ep.file))))
      yield client.perform(path.join(televisionSection, 'refresh'))
    } catch (err) {
      console.error('Delete failed', err)
    }
  }

  stopSpinner()

  displaySummary()

  function displaySummary () {
    const wouldBe = dryRun ? chalk.yellow(' (would be)') : ''
    console.log('%s Total%s deleted: %d episodes', logSymbols.success, wouldBe, totalEpisodes)
    console.log('%s Space%s recovered: %s', logSymbols.success, wouldBe, chalk.green(humanize.filesize(totalBytes)))
  }

  function ignore (filepath) {
    if (dnd == null) {
      return false
    }
    return dnd.some(show => ~filepath.toLowerCase().indexOf(show.toLowerCase()))
  }
})()
.catch(error => console.error(error))
