//var Colu = require('colu-node')
var Colu = require('../src/index.js')

var privateSeed = 'c507290be51bca9b787af39019f80e2f9f27e4020ee0a4fe51695ee4424d6150'

Colu.init('my_company', 'testnet', privateSeed, function(err, colu) {
  if (err) {
    return console.log('err: '+err)
  }

  var username = 'bobicbob41'
  var assetId = 'oH8ufSixYep1wrBFcSbQeKipyXYdGxPGYh'

  colu.verifyUser(username, assetId, function(err, data) {
    if (err) {
      console.error('error: '+err)
    }
    else {
      console.log('data: '+JSON.stringify(data))
    }
  })
})
