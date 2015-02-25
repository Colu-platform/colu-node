//var Colu = require('colu-node')
var Colu = require('../src/index.js')

var privateKey = 'cQQy71GeXGeFWnDtypas2roY2qrk3KWjJLCxoFqc2wibXr2wWxie'

var colu = new Colu('my_company', 'testnet', privateKey)

var username = 'bob'
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
    if (err) {
      console.error('error: '+err)
    }
    else {
      console.log('userId: '+data)
    }
  })
})

// userId: tpubDDYsxVf9LYxR6PMSss1hM8XpKPMMH2hywpuwzf11DzcRYLGSgtpo3ucPkghjeUiyB7xA6qnXsEzMnJ7FyMaVWMfcFszpintAMh2221ybVZo
