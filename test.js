var Colu = require('./index.js');
var fs = require('fs');

var privateKey = 'cQQy71GeXGeFWnDtypas2roY2qrk3KWjJLCxoFqc2wibXr2wWxie';
var cc = '931c20ed3a1bcc4a8ff59d17b5fb80839a921e68b722726419078934078778eb';
var i = '4b8bd38955db0008';

var colu = new Colu('test_company', privateKey, cc, i);


var registrationMessage = colu.createRegistrationMessage('tal');

//console.log('registrationMessage '+JSON.stringify(registrationMessage));

var qr = colu.createRegistrationQR(registrationMessage);

function decodeBase64Image(dataString) {
  var matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/),
    response = {};

  if (matches.length !== 3) {
    return new Error('Invalid input string');
  }

  response.type = matches[1];
  response.data = new Buffer(matches[2], 'base64');

  return response;
}

var imageBuffer = decodeBase64Image(qr);

fs.writeFile('test.jpg', imageBuffer.data, function(err) {  });

colu.registerUser(registrationMessage, function(err, data) {
  if (err) {
    console.log('err '+err);
  }
  else {
    console.log('data '+data);
  }
});


////////////////////

var clientPublicKey = '036e747f286883594d8bcc21048e75fa7c16ff135e304b653416e8c74b073c2ee1';

colu.verifyUser('tal', clientPublicKey, function(err, data) {
  if (err) {
    console.log('err '+err);
  }
  else {
    console.log('data '+data);
  }
});
