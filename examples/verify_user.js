//var Colu = require('colu-node')
var Colu = require('../src/index.js')

var privateKey = 'cQQy71GeXGeFWnDtypas2roY2qrk3KWjJLCxoFqc2wibXr2wWxie'
var cc = '931c20ed3a1bcc4a8ff59d17b5fb80839a921e68b722726419078934078778eb'
var i = '4b8bd38955db0008'

var colu = new Colu('my_company', privateKey, cc, i)

var username = 'tal'
var clientPublicKey = '02cd42e8bc0e38e7bc189934b05f407b09c7e94e12ec952a61939090da74de72fa'

colu.verifyUser(username, clientPublicKey, function(err, data) {
  if (err) {
    console.error('error: '+err)
  }
  else {
    console.log('data: '+JSON.stringify(data))
  }
})
