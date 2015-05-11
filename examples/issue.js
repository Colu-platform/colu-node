//var Colu = require('colu-node')
var Colu = require('../src/index.js')

var privateSeed = 'c507290be50bc29a787af1901ff80e1c9f17e4020ee0a4fd51495ee4424d6150'

Colu.init('my_company', 'testnet', privateSeed, function(err, colu) {
  if (err) {
    return console.log('err: '+err)
  }
  // This is your private seed, keep it safe!!!
  console.log('seed: '+colu.getPrivateSeed())
  
  var nextAccount = 1 //colu.nextAccount
  console.log('nextAccount: '+colu.nextAccount)
  
  colu.issue('bob_'+nextAccount, nextAccount, 1,  function(err, data) {
    if (err) {
      console.error('error: '+err)
    }
    else {
      console.log('data: '+JSON.stringify(data))
    }
  })
})
