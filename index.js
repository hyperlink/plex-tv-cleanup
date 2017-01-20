#!/usr/bin/env node

"use strict"

const Promise        = require('bluebird')
const logSymbols     = require('log-symbols')
const PlexAPI        = require('plex-api')
const JSONPath       = require('JSONPath')
const path           = require('path')
const fs             = Promise.promisifyAll(require('fs'))
const humanize       = require('humanize')
const chalk          = require('chalk')
const elegantSpinner = require('elegant-spinner')
const logUpdate      = require('log-update')
const frame          = elegantSpinner()
const os             = require('os')
const CONFIG_PATH    = os.homedir() +'/.plex-tv-cleanup-config'

try {
	var config = require(CONFIG_PATH)
} catch(e) {
	console.error(logSymbols.error, 'Please create', chalk.green(CONFIG_PATH +'.json'), 'with your configuration. See https://github.com/hyperlink/plex-tv-cleanup/blob/master/README.md#installation')
	return
}

if (config.plex.homeUser) {
	console.warn(`${logSymbols.warning} homeUser has been renamed to managedUser please update your config.`)
	config.plex.managedUser = config.plex.homeUser;
}

const dnd    = config.dnd
const client = new PlexAPI(config.plex)

let spinnerIntervalId = null
function startSpinner() {
	spinnerIntervalId = setInterval(() => logUpdate(frame()), 50)
}

function stopSpinner() {
	clearInterval(spinnerIntervalId)
	logUpdate('')
}

let show = data => console.log(JSON.stringify(data, null, ' '))

let dryRun = process.argv.slice(2).some(arg => arg == '--dry-run')

let televisionSection, totalBytes, totalEpisodes

client.find('/library/sections', {type: 'show'})
	.then(result => {
		if (result.length > 1) {
			throw new Error('Multiple TV sections found.')
		}

		if (result.length == 0) {
			throw new Error('No TV sections were found.')
		}

		televisionSection = result[0].uri
		console.log(`TV URI : ${televisionSection}`)
		let allShows = path.join(result[0].uri, 'allLeaves')
		return client.find(allShows)
	})
	.then(result => {
		let viewed = ep => ep.viewCount
		let viewedEpisodes = result.filter(viewed)
		let filesToDelete = JSONPath({json: viewedEpisodes, path: '$..file', resultType: 'parent'}).filter(ep => !ignore(ep.file))

		filesToDelete.forEach(ep => console.log(' %s %s | %s', logSymbols.info, path.basename(ep.file), chalk.green(humanize.filesize(ep.size))))

		totalBytes = filesToDelete.reduce((prev, ep) => prev + ep.size, 0)
		totalEpisodes = filesToDelete.length

		startSpinner()

		if (dryRun) {
			console.log(logSymbols.info, 'Dry Run')
			return []
		}
		return filesToDelete
	})
	.then(files => Promise.all(files.map(ep => fs.unlinkAsync( decodeURIComponent(ep.file)) )))
	.then(() => dryRun ? true : client.perform(path.join(televisionSection, 'refresh')), err => console.error('Delete failed', err))
	.then(stopSpinner)
	.catch(err => console.error(logSymbols.error, 'Could not connect to server', err))
	.then(displaySummary)

function displaySummary() {
	let wouldBe = dryRun ? chalk.yellow(' (would be)') : ''
	console.log('%s Total%s deleted: %d episodes', logSymbols.success, wouldBe, totalEpisodes)
	console.log('%s Space%s recovered: %s',logSymbols.success, wouldBe, chalk.green(humanize.filesize(totalBytes)))
}

function ignore(filepath) {
	if (dnd == undefined) {
		return false
	}
	return dnd.some(show => ~filepath.toLowerCase().indexOf(show.toLowerCase()))
}
