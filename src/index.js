// Description:
//   Ask hubot about the current or future status of the iss
//
// Dependencies:
//   "moment-timezone": "^0.5.3"
//   "node-geocoder": "^3.9.1"
//   "request": "^2.69.0"
//
// Commands:
//   hubot where is the iss now? - Display a google map with the last location of the ISS
//   hubot when does the iss pass <location>? - Display a list of dates when ISS will fly over a specified location
//
// Author:
//   ljcl <luke@lukeclark.com.au>
'use strict'

import moment from 'moment-timezone'
import request from 'request'
import GeoCoder from 'node-geocoder'
const geocoder = GeoCoder('google', 'http')

/**
 * Query astroviewer and dangerously turn the javascript into parsable JSON.
 * @param  {object}   options An object containing the latitude, longitude and location name
 * @param  {Function} cb
 */
function astroViewer (options, cb) {
  request({
    url: 'http://astroviewer-sat2c.appspot.com/predictor',
    qs: {
      var: 'passesData',
      lat: options.lat,
      lon: options.lon,
      name: options.name
    },
    headers: {
      'User-Agent': 'request'
    }
  }, function (error, response, body) {
    if (error) {
      cb(error)
    }
    // Trim the javascript response
    var raw = body.slice(17).slice(0, -2)
    // make sure the keys have quotes around them
    raw = raw.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":')
    // turn the result into valid JSON (hopefully)
    var info = JSON.parse(raw)
    cb(false, info)
  })
}

/**
 * Build up a string based on the astroViewer data
 * @param  {object}   data Return the astroviewer object
 * @param  {Function} cb
 */
function listPasses (data, cb) {
  var index = 0
  var passes = data.passes
  var newpasses = ''
  if (passes.length === 0) {
    newpasses += ':( No results found for **' + data.location.name + '**'
  } else {
    passes.map(function (obj) {
      if (index === 0) {
        newpasses += '**' + data.location.name + '** (' + obj.timezone + ')\n'
      }
      var dateFormat = 'YYYYMMDDHHmmss'
      var newDateFormat = 'ddd MMM Do, hh:mma'
      var begin = moment(obj.begin, dateFormat).format(newDateFormat)
      var duration = moment.utc(moment(obj.end, dateFormat).diff(moment(obj.begin, dateFormat))).format('m\\m s\\s')
      newpasses += begin + ' (' + duration + ')\n'
      index++
    })
  }
  newpasses += ':satellite:'
  cb(false, newpasses)
}

module.exports = (robot) => {
  // Respond with the location and a map of the reported location of the ISS
  robot.hear(/(where is the)? (iss now)(\?)?/i, (res) => {
    // Get data from the Open Notify service
    request('http://api.open-notify.org/iss-now.json', {timeout: 10000}, function (error, response, body) {
      if (error) {
        if (error.code !== 'ETIMEDOUT') throw new Error(error)
        res.send('Can\'t check there whereabouts of the ISS right now :( Try again in a little bit.')
      } else {
        body = JSON.parse(body);
        // Create a static google map with the latitude and longitude of the reponse
        var staticMap = 'https://maps.googleapis.com/maps/api/staticmap?zoom=2&size=400x400&markers=' + body.iss_position.latitude + ',' + body.iss_position.longitude
        var locInfo = "Looks like it's over water\n" + staticMap // Default message if nothing overwrites it
        geocoder.reverse({lat: body.iss_position.latitude, lon: body.iss_position.longitude}, function (err, resp) {
          console.log(resp)
          if (err && resp.raw.status !== 'ZERO_RESULTS') {
            // No results is technically an error but we don't want to throw it as one
            throw new Error(err)
          } else if (resp.raw.status !== 'ZERO_RESULTS') {
            locInfo = resp[0].formattedAddress + '\n' + staticMap // Use first result
          }
          res.send(locInfo)
        })
      }
    })
  })

  robot.hear(/(when does the)? (iss) (flyover|fly over|pass|pass over) (.*)/i, (res) => {
    var location = res.match[4].replace(/\?/g, '')
    geocoder.geocode(location, function (err, resp) {
      var message = "Couldn't find a location by that name" // Default return message
      if (err) throw new Error(err)
      if (resp.length > 0) {
        // As long as there's at least one, we'll only ever use the first result though
        resp = resp[0]
        astroViewer({lat: resp.latitude, lon: resp.longitude, name: resp.formattedAddress}, function (error, result) {
          if (error) throw new Error(error)
          listPasses(result, function (err, message) {
            if (err) throw new Error(err)
            res.send(message)
          })
        })
      } else {
        res.send(message)
      }
    })
  })
}
