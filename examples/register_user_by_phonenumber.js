//var Colu = require('colu-node')
var Colu = require('../src/index.js')

var privateKey = 'cQQy71GeXGeFWnDtypas2roY2qrk3KWjJLCxoFqc2wibXr2wWxie'

var colu = new Colu('my_company', 'testnet', privateKey)

var username = 'bob'
var phonenumber = '+123456789010'
var registrationMessage = colu.createRegistrationMessage(username)

colu.registerUserByPhonenumber(registrationMessage, phonenumber, function(err, data) {
  if (err) {
    console.error('error: '+err)
  }
  else {
    console.log('userId: '+data)
  }
})

// userId: tpubDDYsxVf9LYxR6PMSss1hM8XpKPMMH2hywpuwzf11DzcRYLGSgtpo3ucPkghjeUiyB7xA6qnXsEzMnJ7FyMaVWMfcFszpintAMh2221ybVZo
