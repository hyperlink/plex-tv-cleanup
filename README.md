# Plex TV Show Cleanup

NodeJs script to delete watched TV episodes from Plex. You can configure a whitelist to prevent deletion.

* Automatically finds the TV Section in Plex
* Gives a breakdown how much space each episode takes up
* Deletes watched TV episodes
* Performs a refresh of the TV section
* Shows how much space was recovered

[![Standard - JavaScript Style Guide](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)

## Installation

### Step 1

Install NodeJs and plex tv cleanup on your Plex server.

```
npm i -g plex-tv-cleanup
```

### Step 2

Create a new JSON file in `~/.plex-tv-cleanup-config.json` and fill it with your information like below:

Example:

```json
{
  "plex": {
    "hostname": "127.0.0.1",
    "username": "<Your Username>",
    "password": "<Your Password>",
    "managedUser": {
    	"name": "Family",
    	"pin": "1234"
    }
  },
  "dnd": [
    "/Volumes/SavedTVShows",
    "iZombie",
    "The Expanse",
    "Into the Badlands"
  ]
}
```

* `plex.hostname` is **required**
* `plex.username`, `plex.password` and `plex.managedUser` are required if you have [Plex Home](https://support.plex.tv/hc/en-us/sections/200641063) enabled
* `dnd` is optional *Do Not Delete* whitelist of dir path or file names

## Usage

Run `./plex-tv-cleanup` to execute it.

Dry run to see what it would delete run `./plex-tv-cleanup --dry-run`

## License

### MIT
