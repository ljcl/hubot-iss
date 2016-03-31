'use strict'

import moment from 'moment-timezone'
import request from 'request'
import GeoCoder from 'node-geocoder'
const geocoder = GeoCoder('google', 'http')
// geocoder

module.exports = (robot) => {
  // Respond with the location and a map of the reported location of the ISS
  robot.hear(/(where is the)? (iss now)/i, (res) => {
    // Get data from the Open Notify service
    request('http://api.open-notify.org/iss-now.json', function (error, response, body) {
      if (error) throw new Error(error)
      body = JSON.parse(body)
      // Create a static google map with the latitude and longitude of the reponse
      var staticMap = 'https://maps.googleapis.com/maps/api/staticmap?zoom=1&size=400x500&autoscale=2&markers=' + body.iss_position.latitude + ',' + body.iss_position.longitude
      var locInfo = "Looks like it's over water (" + staticMap + ")" // Default message if nothing overwrites it
      geocoder.reverse({lat: body.iss_position.latitude, lon: body.iss_position.longitude}, function (err, resp) {
        if (err && resp.raw.status !== 'ZERO_RESULTS') {
          // No results is technically an error but we don't want to throw it as one
          throw new Error(err)
        } else if (resp.raw.status !== 'ZERO_RESULTS') {
          locInfo = resp[0].formattedAddress + ' (' + staticMap + ')' // Use first result
        }
        res.send(locInfo)
      })
    })
  })

  request({
    url: 'https://maps.googleapis.com/maps/api/timezone/json',
    qs: { location: '39.6034810' + ',' + '-119.6822510', timestamp: '1331161200' }
  }, function (err, resp, body) {
    body = JSON.parse(body)
  })

  function timezoneId (location, cb) {
    // Accepts location (lat,long) and unix timestamp and returns timezone info as a callback
    var timestamp = Math.floor((new Date).getTime() / 1000)
    request({
      url: 'https://maps.googleapis.com/maps/api/timezone/json',
      qs: {
        location: location,
        timestamp: timestamp // Doesn't matter, use whatever
      }
    }, function (err, resp, body) {
      body = JSON.parse(body)
      cb(body)
    })
  }

  // https://maps.googleapis.com/maps/api/timezone/json?location=39.6034810,-119.6822510&timestamp=1331161200

  robot.hear(/(when does the)? (iss) (flyover|fly over) (.*)/i, (res) => {
    var location = res.match[4]
    var timeZoneId = 'Australia/Sydney'
    geocoder.geocode(location, function (err, resp) {
      var message = "Couldn't find a location by that name" // Default return message
      if (err) throw new Error(err)
      if (resp.length > 0) {
        // As long as there's at least one, we'll only ever use the first result though
        resp = resp[0]
        request({
          url: 'http://api.open-notify.org/iss-pass.json',
          qs: { lat: resp.latitude, lon: resp.longitude }
        }, function (error, response, body) {
          if (error) throw new Error(error)
          body = JSON.parse(body)
          var riseTimes = body.response
          message = 'The next 5 computed passes for the ISS from *' + resp.formattedAddress + '* are:\n'
          riseTimes.map(function (obj, index) {
            // Make the returned data a little more readable
            timezoneId(resp.latitude + ',' + resp.longitude, (timezone) => {
              timeZoneId = timezone.timeZoneId
              var risetime = moment.unix(obj.risetime)
              var risetimeLocal = moment.tz(risetime, timeZoneId).format('ddd MMM D, H:mma ZZ')
              var duration = moment.duration(obj.duration, 'seconds').humanize()
              message += risetimeLocal + ' (for ' + duration + ')'
              if (index + 1 !== riseTimes.length) {
                message += '\n'
              } else {
                res.send(message)
              }
            })
          })
        })
      } else {
        res.send(message)
      }
    })
  })
}
