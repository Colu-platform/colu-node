//var Colu = require('colu-node')
var Colu = require('../src/index.js')

var privateSeed = 'c507290be50bca9b787af39019f80e1f9f17e4020ee0a4fe51595ee4424d6150'

Colu.init('my_company', 'testnet', privateSeed, function(err, colu) {
  if (err) {
    return console.log('err: '+err)
  }

  var username = 'bobicbob20'

  colu.verifyUser(username, 'od8U4iiVW6BEGPoSPXjmkJ1fREWF2bqVxn', function(err, data) {
    if (err) {
      console.error('error: '+err)
    }
    else {
      console.log('data: '+JSON.stringify(data))
    }
  })
})
