# Colu-node
Colu platform, node.js SDK

## Install

```bash
$ npm install colu-node
```

## Generate keys for your company:
If you create an instance of the ```colu``` module with only the company name, the ```privateKey```, ```cc``` and ```i``` keys will generate randomly on your machine.  
Your ```cc``` and ```i``` with your ```privateKey``` is what define your company. With this keys your clients can create a HD wallet with you, see [BIP32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki).
```js
var Colu = require('colu-node')
var colu = new Colu('my_company')

// This is your private key, keep it safe!!!
console.log('WIF: '+colu.getWIF())

// Those are your cc and i, they are public and should be registered on the blockchain using the register method.
console.log('cc: '+colu.cc) 
console.log('i: '+colu.i)
```

## Register your company to the blockchain:
After generating your keys you need to register your ```cc``` and ```i``` to the blockchain and signing them with your ```privateKey```.

```js
colu.register(function(err, data) {
  if (err) {
    console.error('error: '+err)
  }
  else {
    console.log('data: '+JSON.stringify(data))
  }
})
```

It should return two transaction ids:
* The first on is us paying you the fees.
* The second one is you uploading to the blockchain your ```cc``` and ```i``` using ```OP_RETURN```.

## Create instance from existing keys:
When you want to use our module in your server you need to do the generation of keys and registration only once. After that all you need to do is to create an instance of ```Colu``` with your keys:
```js
var Colu = require('colu-node')

var privateKey = 'cQQy71GeXGeFWnDtypas2roY2qrk3KWjJLCxoFqc2wibXr2wWxie'
var cc = '931c20ed3a1bcc4a8ff59d17b5fb80839a921e68b722726419078934078778eb'
var i = '4b8bd38955db0008'

var colu = new Colu('my_company', privateKey, cc, i)
```

## Register a user to 2FA:
You can register a user to the Colu 2FA service on your our site with 3 simple steps:  
1. Create a registration message:  
  ```js
  var username = 'tal'
  var registrationMessage = colu.createRegistrationMessage(username)
  ```  
2. Create a registration QR code:  
  ```js
  var qr = colu.createRegistrationQR(registrationMessage);
  ```  
3. Show to the user the QR code in your site to scan with our mobile application, and prompt our server:  
 ```js
  colu.registerUser(registrationMessage, function(err, data) {
    if (err) {
      console.error('error: '+err)
    }
    else {
      console.log('data: '+JSON.stringify(data))
    }
  })
  ```
You should get back the ```clientPublicKey``` you should save it in order to verify this user in the future.

## Verify user:
To verify a user all you need to do is:
```js
var clientPublicKey = '036e747f286883594d8bcc21048e75fa7c16ff135e304b653416e8c74b073c2ee1'
var username = 'tal'

colu.verifyUser(username, clientPublicKey, function(err, data) {
  if (err) {
    console.error('error: '+err)
  }
  else {
    console.log('data: '+JSON.stringify(data))
  }
})
```
This will send a push to the user mobile application and prompt him to sign on your message, you will receive the user signature and verify it locally.