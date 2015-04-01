//var Colu = require('colu-node')
var Colu = require('../src/index.js')

var privateSeed = 'c507290be50bc29a787a919019f80e1c9f17e4020ee0a4fd51495ee4424d6150'

Colu.init('my_company', 'testnet', privateSeed, function(err, colu) {
  if (err) {
    return console.log('err: '+err)
  }
  // This is your private seed, keep it safe!!!
  console.log('seed: '+colu.getPrivateSeed())
  
  var nextAccount = 1 //colu.nextAccount
  console.log('nextAccount: '+colu.nextAccount)
  colu.send('bWy1S6rUnwV2H6vVXfzRH6h6DRZeBSVVUyx', nextAccount, 'oZLEiyjvsB6JNECuKCZ1v6UU4JE4SwvRhv', function(err, data) {
    if (err) {
      console.error('error: '+err)
    }
    else {
      console.log('data: '+JSON.stringify(data))
    }
  })
})