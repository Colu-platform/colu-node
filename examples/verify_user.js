//var Colu = require('colu-node')
var Colu = require('../src/index.js')

var privateKey = 'cQQy71GeXGeFWnDtypas2roY2qrk3KWjJLCxoFqc2wibXr2wWxie'

var colu = new Colu('my_company', 'testnet', privateKey)

var username = 'tal'
var userId = 'tpubDCgCu2jpxrR7byQ7t79yXCEa87sQvGJUjuaSxNrXhMCLLUNRYZe6WNgcaSGT3d6vrZ9476S3dCFT3B3KQDSae3pcPzNSFb54xrH18bHXSqC'

colu.verifyUser(username, userId, 0, function(err, data) {
  if (err) {
    console.error('error: '+err)
  }
  else {
    console.log('data: '+JSON.stringify(data))
  }
})
