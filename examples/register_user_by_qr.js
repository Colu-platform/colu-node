//var Colu = require('colu-node')
var Colu = require('../src/index.js')
var User = require('../src/user.js')

var privateSeed = 'c507290be50bca9b987af39019f80e1f9f17e4020ee0a4fe51595ee4424d6150'

Colu.init('my_company', 'testnet', privateSeed, function(err, colu) {
  if (err) {
    return console.log('err: '+err)
  }
  // This is your private seed, keep it safe!!!
  console.log('seed: '+colu.getPrivateSeed())

  var username = 'bobicbob30'
  var registrationMessage = colu.createRegistrationMessage(username)

  // You can create your own complicated qr code, or you can generate a simplified code and get it back from us in a callback.
  // var qr = colu.createRegistrationQR(registrationMessage)

  colu.getRegistrationQR(registrationMessage, function(err, code, qr) {
    if (err) return console.error('error: '+err)
    // You can use the QR in your site using it as src of img tag:
    // '<img src="' + qr + '" alt="Scan Me" height="200" width="200">'
    // or you can write it to a file like that:

    var fs = require('fs')

    function decodeBase64Image(dataString) {
      var matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
      response = {}

      if (matches.length !== 3) {
        return new Error('Invalid input string')
      }

      response.type = matches[1]
      response.data = new Buffer(matches[2], 'base64')

      return response
    }

    var imageBuffer = decodeBase64Image(qr)
    var filename = 'qr.jpg'
    fs.writeFile(filename, imageBuffer.data, function(err) {  })

    // Now you can show the QR to the user to scan, and prompt our server for an answer when the user register successfully:

    colu.registerUser(registrationMessage, code, function(err, data) {
      if (err) return console.log('Error: '+ JSON.stringify(err))
      console.log('userId: '+data.userId)
//        console.log('assetId: '+data.assetId)
      var username = colu.getUsername(registrationMessage)
      var accountIndex = colu.hdwallet[registrationMessage.company_public_key].accountIndex
      var user = new User(data.userId)
      return colu.issueAndSend(username, accountIndex, user, function (err, assetId) {
        if (err) return console.log('Error: '+ JSON.stringify(err))
        console.log('assetId: '+assetId)
      })
    })
  })
})

