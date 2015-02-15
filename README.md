# Colu-node
Colu platform, node.js SDK

## Install

```bash
$ npm install colu-node
```

## Generate keys for your company:
If you create an instance of the ```colu``` module with only the company name, the ```privateKey``` will generate randomly on your machine.  
Your ```privateKey``` is what define your company.
```js
var Colu = require('colu-node')
var colu = new Colu('my_company', 'testnet')

// This is your private key, keep it safe!!!
console.log('WIF: '+colu.getWIF())

```

## Create instance from existing keys:
When you want to use our module in your server you need to do the generation of keys only once. After that all you need to do is to create an instance of ```Colu``` with your key:
```js
var Colu = require('colu-node')

var privateKey = 'cQQy71GeXGeFWnDtypas2roY2qrk3KWjJLCxoFqc2wibXr2wWxie'

var colu = new Colu('my_company', 'testnet', privateKey)
```

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
      console.log('userId: '+data)
    }
  })
  ```

You should get back the ```userId``` you should save it in order to verify this user in the future.

## Verify user:
To verify a user all you need to do is:
```js
var username = 'bob'
var userId = 'tpubDCgCu2jpxrR7j9JwFQ959wSkNwPQFNQvJJMFnikg1Sb4tkDnBNYaS3Sc1BxKL71hk3jPkQStEY1VE9mTaQjF8kDfEhzxjWid7eVK5F7nWi5'

colu.verifyUser(username, userId, 0, function(err, data) {
  if (err) {
    console.error('error: '+err)
  }
  else {
    console.log('data: '+JSON.stringify(data))
  }
})
```
This will send a push to the user mobile application and prompt him to sign on your message, you will receive the user signature and verify it locally.