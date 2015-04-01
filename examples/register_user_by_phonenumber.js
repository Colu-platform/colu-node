//var Colu = require('colu-node')
var Colu = require('../src/index.js')

var privateSeed = 'c507290be50bca9b787af39019f80e2f9f27e4020ee0a4fe51595ee4424d6150'

Colu.init('my_company', 'testnet', privateSeed, function(err, colu) {
  if (err) {
    return console.log('err: '+err)
  }
  // This is your private seed, keep it safe!!!
  console.log('seed: '+colu.getPrivateSeed())

  var username = 'bobicbob24'

  var phonenumber = '+1234567890'
  var registrationMessage = colu.createRegistrationMessage(username)

  colu.registerUserByPhonenumber(registrationMessage, phonenumber, function(err, data) {
    if (err) {
      console.error('error: '+err)
    }
    else {
      console.log('userId: '+data)
    }
  })
})

// userId: tpubDDYsxVf9LYxR6PMSss1hM8XpKPMMH2hywpuwzf11DzcRYLGSgtpo3ucPkghjeUiyB7xA6qnXsEzMnJ7FyMaVWMfcFszpintAMh2221ybVZo
