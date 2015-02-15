//var Colu = require('colu-node')
var Colu = require('../src/index.js')

var privateKey = 'cQQy71GeXGeFWnDtypas2roY2qrk3KWjJLCxoFqc2wibXr2wWxie'

var colu = new Colu('my_company', 'testnet', privateKey)

var username = 'tal'
var userId = 'tpubDCgCu2jpxrR7j9JwFQ959wSkNwPQFNQvJJMFnikg1Sb4tkDnBNYaS3Sc1BxKL71hk3jPkQStEY1VE9mTaQjF8kDfEhzxjWid7eVK5F7nWi5'

colu.verifyUser(username, userId, 0, function(err, data) {
  if (err) {
    console.error('error: '+err)
  }
  else {
    console.log('data: '+JSON.stringify(data))
  }
})
