//var Colu = require('colu-node')
var Colu = require('../src/index.js')

var privateKey = 'cQQy71GeXGeFWnDtypas2roY2qrk3KWjJLCxoFqc2wibXr2wWxie'

var colu = new Colu('my_company', 'testnet', privateKey)

var username = 'bob'
var userId = 'tpubDCj6AQEUBWm7LKtX1RJAHKH4YXyJUkVbz3or6gEZ7XcmdvdW5i73NeK7PcqvkgcCWdiPo53m5r556P8ns2E2q7tisMDdtwnohTk96uqorcW'

colu.verifyUser(username, userId, 0, function(err, data) {
  if (err) {
    console.error('error: '+err)
  }
  else {
    console.log('data: '+JSON.stringify(data))
  }
})
