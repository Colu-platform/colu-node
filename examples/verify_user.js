//var Colu = require('colu-node')
var Colu = require('../src/index.js')

var privateKey = 'cQQy71GeXGeFWnDtypas2roY2qrk3KWjJLCxoFqc2wibXr2wWxie'

var colu = new Colu('my_company', 'testnet', privateKey)

var username = 'bob'
var userId = 'tpubDCz2Du58pUuEqjeicCJvfp3mp3oUgwCG51iCsCuxATAAj3aWmNz8tQySkg3HFXj5CGNqj9axaZppoTFTX7iZZdoMods2VR75zpxek6RE5tQ'

colu.verifyUser(username, userId, 0, function(err, data) {
  if (err) {
    console.error('error: '+err)
  }
  else {
    console.log('data: '+JSON.stringify(data))
  }
})
