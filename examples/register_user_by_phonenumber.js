//var Colu = require('colu-node')
var Colu = require('../src/index.js')
var User = require('../src/user.js')

var privateSeed = 'c507290be51cca9b787af39019f80e2faf27e4020ee0a4fe51695ee4424d6150'

Colu.init('my_company', 'testnet', privateSeed, function(err, colu) {
  if (err) {
    return console.log('err: '+err)
  }
  // This is your private seed, keep it safe!!!
  console.log('seed: '+colu.getPrivateSeed())

  var username = 'bobicbob52'

  var phonenumber = '+1234567890123'
  var registrationMessage = colu.createRegistrationMessage(username)

  colu.registerUserByPhonenumber(registrationMessage, phonenumber, function(err, data) {
    if (err) return console.log('Error1: '+ JSON.stringify(err))
    console.log('userId: '+data.userId)
//      console.log('assetId: '+data.assetId)
    var username = colu.getUsername(registrationMessage)
    var accountIndex = colu.hdwallet[registrationMessage.company_public_key].accountIndex
    var user = new User(data.userId)
    return colu.issueAndSend(username, accountIndex, user, function (err, assetId) {
      if (err) return console.log('Error2: '+ JSON.stringify(err))
      console.log('assetId: '+assetId)
    })
  })
})

