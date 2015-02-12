//var Colu = require('colu-node')
var Colu = require('../src/index.js')

var privateKey = 'cQQy71GeXGeFWnDtypas2roY2qrk3KWjJLCxoFqc2wibXr2wWxie'
var cc = '931c20ed3a1bcc4a8ff59d17b5fb80839a921e68b722726419078934078778eb'
var i = '4b8bd38955db0008'

var colu = new Colu('my_company', 'testnet', privateKey, cc, i)

var username = 'tal'
var userId = '03d24e4acaf73a93469508daa6b1758d18313176c44f4816454161b18d893d65a9cd8f23a6dfb786e6a20ef7509cc151aa43b8cba82a20b1ec7c2da7e8b09b5a17'

colu.verifyUser(username, userId, 0, function(err, data) {
  if (err) {
    console.error('error: '+err)
  }
  else {
    console.log('data: '+JSON.stringify(data))
  }
})
