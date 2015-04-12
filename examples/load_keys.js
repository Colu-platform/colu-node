//var Colu = require('colu-node')
var Colu = require('../src/index.js')
var User = require('../src/user.js')

var privateSeed = 'c507290be51cca9b787af39019f80e2faf27e4020ee0a4fe51695ee4424d6150'

Colu.init('my_company', 'testnet', privateSeed, function(err, colu) {
  if (err) {
    return console.log('err: '+err)
  }
  // This is your private seed, keep it safe!!!
  console.log('seed: '+colu.getPrivateSeed())

})

