# Colu-node
Colu platform, node.js SDK

## Install

```bash
$ npm install colu-node
```

## Generate keys for your company:
If you create an instance of the ```colu``` module with only the company name, the ```privateSeed``` will generate randomly on your machine.  
Your ```privateSeed``` is what define your company.
```js
Colu.init('my_company', 'testnet', function(err, colu) {
  if (err) {
    return console.log('err: '+err)
  }
  // This is your private seed, keep it safe!!!
  console.log('Private seed: '+colu.getPrivateSeed())
})
```

## Create instance from existing keys:
When you want to use our module in your server you need to do the generation of keys only once. After that all you need to do is to create an instance of ```Colu``` with your key:
```js
var Colu = require('colu-node')

var privateSeed = 'c507290be50bca9b787af39019f80e2f9f27e4020ee0a4fe51595ee4424d6150'

Colu.init('my_company', 'testnet', privateSeed, function(err, colu) {
  if (err) {
    return console.log('err: '+err)
  }
  // This is your private seed, keep it safe!!!
  console.log('seed: '+colu.getPrivateSeed())
  
})
```
The colu instance returned in the callback function goes through a discovering processes of your active keys using [BIP32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki) and [BIP32](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki) schemes.

## Register a user to 2FA:
You can register a user to the Colu 2FA service on your our site with 3 simple steps:

1. Create a registration message:

  ```js
  var username = 'bob'
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
      console.log('userId: '+data.userId)
      console.log('assetId: '+data.assetId)
    }
  })
  ```

You should get back the ```userId``` and the ```assetId```.
You need to save the ```assetId``` in order to verify this user in the future.
You can also use the ```userId``` in order to send this register user other assets.

## Verify user:
To verify a user all you need to do is:
```js
var username = 'bobic'
var assetId = 'od8U4iiVW6BEGPoSPXjmkJ1fREWF2bqVxn'

colu.verifyUser(username, assetId, function(err, data) {
  if (err) {
    console.error('error: '+err)
  }
  else {
    console.log('data: '+JSON.stringify(data))
  }
})
```
This will send a push to the user that holds the asset mobile application and prompt him to sign on your message, you will receive the user signature and verify it locally.
