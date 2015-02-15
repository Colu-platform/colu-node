//var Colu = require('colu-node')
var Colu = require('../src/index.js')

var privateKey = 'cQQy71GeXGeFWnDtypas2roY2qrk3KWjJLCxoFqc2wibXr2wWxie'

var colu = new Colu('my_company', 'testnet', privateKey)

var username = 'tal'
var registrationMessage = colu.createRegistrationMessage(username)

var qr = colu.createRegistrationQR(registrationMessage)

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

colu.registerUser(registrationMessage, function(err, data) {
  if (err) {
    console.error('error: '+err)
  }
  else {
    console.log('userId: '+data)
  }
})

// data: {"client_public_key":"02cd42e8bc0e38e7bc189934b05f407b09c7e94e12ec952a61939090da74de72fa","verified_client_signature":"{\"s\":\"3fdb4f06de01b18102c4ce2e8d006b4046a0877d240046660aadbb0a631aa1fa\",\"r\":\"d0cd1966b41798854ee44e9dd0574522e264cbfbcc94450b35cdff475664d188\"}"}
// It is important to save the client_public_key in order to verify him in the future