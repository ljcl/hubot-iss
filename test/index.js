'use strict'

const Helper = require('hubot-test-helper')
const expect = require('chai').expect
const http = require('http')

const helper = new Helper('../src/index.js')

describe('hubot', () => {
  let room

  beforeEach(() => room = helper.createRoom())
  afterEach(() => room.destroy())

  it('should respond when asked where the ISS is', done => {
    room.user.say('alice', 'hubot where is the iss now?').then(() => {
      console.log('OH?!')
      expect(room.messages).to.eql([['alice', 'hubot where is the iss now?']])
      expect(room.messages).to.match(/maps.googleapis.com\/maps\/api/)
      done()
    })
  })

  it('should respond when asked when the ISS will be near', done => {
    room.user.say('alice', 'hubot when does the iss pass Sydney?').then(() => {
      expect(room.messages).to.match(/🛰/)
      done()
    })
  })
})
