//var Colu = require('colu-node')
var Colu = require('../src/index.js')
var colu = new Colu('my_company', 'testnet')

Colu.init('my_company', 'testnet', function(err, colu) {
  if (err) {
    return console.log('err: '+err)
  }
  // This is your private seed, keep it safe!!!
  console.log('Private seed: '+colu.getPrivateSeed())
})
