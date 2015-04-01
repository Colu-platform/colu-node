var bitcoin = require('bitcoinjs-lib')
var crypto = require('crypto')
var request = require('request')
var qr = require('qr-encode')
var bigi = require('bigi')
var assert = require('assert')
var async = require('async')
var crypto = require('crypto')
var User = require('./user.js')

//var coluHost = 'http://127.0.0.1'
var coluHost = 'https://dev.colu.co'
var coloredCoinsHost = 'http://api.colu.co/v1'

var MAX_EMPTY_ACCOUNTS = 3
var MAX_EMPTY_ADDRESSES = 3

module.exports = Colu

function Colu(companyName, network, privateSeed) {
  assert(companyName, 'Need company name as first argument.')
  this.companyName = companyName
  
  if (network && network.toLowerCase() === 'testnet') {
    this.network = bitcoin.networks.testnet
  }  else {
    this.network = bitcoin.networks.bitcoin
  }
  if (!privateSeed) {
    this.privateSeed = crypto.randomBytes(32)
    this.needToDiscover = false
  }
  else {
    this.privateSeed = new Buffer(privateSeed, 'hex')
    this.needToDiscover = true
  }
  this.master = bitcoin.HDNode.fromSeedHex(this.privateSeed, this.network)
  this.nextAccount = 0
  this.hdwallet = {}
  
}

Colu.init = function(companyName, network, privateSeed, callback) {
  var instance = new Colu(companyName, network, privateSeed)
  if (privateSeed) {
    instance.discover(function(err) {
      return callback(err, instance)
    })
  }
  else {
    return callback(null, instance)
  }
}

Colu.prototype.discover = function(callback) {
  var emptyAccounts = 0
  var currentAccount = 0
  async.whilst(
    function () { return emptyAccounts < MAX_EMPTY_ACCOUNTS },
    function (cb) {
      console.log('discovering account: '+currentAccount)
      this.discoverAccount(currentAccount++, function (err, res) {
        if (err) return cb(err)
        if (res) {
          emptyAccounts = 0
          this.nextAccount = currentAccount
        } else {
          emptyAccounts++
        }
        cb()
      }.bind(this))
    }.bind(this),
    function(err) {
      if (err) return callback(err)
      this.needToDiscover = false
      callback()
    }
  )
}

Colu.prototype.discoverAccount = function(accountIndex, callback) {
  var emptyAddresses = 0
  var currentAddresses = 0
  var active = false
  async.whilst(
    function () { return emptyAddresses < MAX_EMPTY_ADDRESSES },
    function (cb) {
      console.log('discovering address: '+currentAddresses)
      this.discoverAddress(accountIndex, currentAddresses++, function (err, res) {
        if (err) return cb(err)
        if (res.active) {
          emptyAddresses = 0
          active = true
          console.log('active')
        } else {
          emptyAddresses++
          console.log('inactive')
        }
        cb()
      })
    }.bind(this),
    function (err) {
      return callback(err, active)
    }
  )
}

Colu.prototype.discoverAddress = function(accountIndex, addressIndex, callback) {
  var hdnode = deriveAddress(this.master, accountIndex, addressIndex)
  var address = hdnode.getAddress().toString()
  console.log('address: '+address)
  isAddressActive(address, callback)
}

Colu.prototype.getPrivateSeed = function() {
  return this.privateSeed.toString('hex')
}

Colu.prototype.createRegistrationMessage = function(username, account) {
  assert(username, 'Need username as first argument.')
  assert(this.needToDiscover, 'Account need to go through discovery process using this.discover(callback) method')
  var rand = crypto.randomBytes(10)
  var rand = rand.toString('hex')
  var utcTS = Date.now().toString()
  var message = {
    username : username,
    timestamp : utcTS,
    rand : rand,
  }
  var messageStr = JSON.stringify(message)
  var privateKey = this.getPrivateKey(account)
  var signature = ecdsaSign(messageStr, privateKey)
  var jsonSignature = JSON.stringify(signature)
  var publicKey = this.getPublicKey(account || this.nextAccount-1)
  console.log('privateKey: '+privateKey.toWIF(this.network))
  console.log('signature: '+signature)
  console.log('jsonSignature: '+jsonSignature)
  console.log('publicKey: '+publicKey.toHex())
  var registrationMessage = { 
    message : messageStr, 
    company_public_key : publicKey.toHex(),
    signature : jsonSignature,
    company_name: this.companyName
  }
  return registrationMessage
}

Colu.prototype.getPrivateKey = function(account, addressIndex) {
  if (typeof(account) == 'undefined') {
    account = account || this.nextAccount++
  }
  console.log('getting private of account '+account)
  addressIndex = addressIndex || 0
  var hdnode = deriveAddress(this.master, account, addressIndex)
  var privateKey = hdnode.privKey
  return privateKey
}

Colu.prototype.getPublicKey = function(account, addressIndex) {
  console.log('getting public of account '+account)
  var privateKey = this.getPrivateKey(account, addressIndex)
  var publicKey = privateKey.pub
  this.hdwallet[publicKey.toHex()] = {
    accountIndex : account || this.nextAccount-1,
    addressIndex : addressIndex || 0,
  }
  return publicKey
}


Colu.prototype.createRegistrationQR = function(registrationMessage) {
  assertRegistrationMessage(registrationMessage)
  var dataURI = qr(JSON.stringify(registrationMessage), {type: 15, size: 10, level: 'L'})
  return dataURI
}

Colu.prototype.getRegistrationQR = function(registrationMessage, callback) {
  assertRegistrationMessage(registrationMessage)
  assert.equal(typeof(callback), 'function', 'Need callback function as last (second) argument.')
  registrationMessage.by_code = true
  request.post(coluHost + "/start_user_registration_to_company",
    {form: registrationMessage },
    function (err, response, body) {
      if (err) {
        return callback(err)
      }
      if (response.statusCode != 200) {
        return callback(body)
      }
      body = JSON.parse(body)
      if ('code' in body) {
        var simpleQrLink = coluHost+"/qr?qr="+body.code
        var dataURI = qr(simpleQrLink, {type: 5, size: 5, level: 'M'})
        callback(null, body.code, dataURI)
      }
      else {
        callback('No code returned from server')
      }
    }
  )
}

Colu.prototype.registerUser = function(registrationMessage, code, callback) {
  assertRegistrationMessage(registrationMessage)
  if (typeof(code) == 'function') {
    callback = code
    code = null
  }
  assert.equal(typeof(callback), 'function', 'Need callback function as last argument.')
  var user
  var username
  var accountIndex
  var issuance
  async.waterfall([
    function(cb) {
      var url = coluHost + "/start_user_registration_to_company"
      var form
      if (code) {
        url = url+"_by_code"
        form = {code : code}
      }
      else {
        form = registrationMessage
      }
      request.post(
        url,
        {form: form},
        cb
      )
    },
    function (response, body, cb) {
      if (response.statusCode != 200) {
        return cb(body)
      }
      body = JSON.parse(body)
      user = this.parseRegistrationBody(body)
      if (user) {
        var client_public_key = user.getPublicKey()
        if (this.verifyMessage(registrationMessage, body.verified_client_signature, client_public_key, body.verified)) {
          username = getUsername(registrationMessage)
          accountIndex = this.hdwallet[registrationMessage.company_public_key].accountIndex
          return this.issueAndSend(username, accountIndex, user, cb)
        }
        else {
          cb('Signature not verified.')
        }
      }
      else {
        cb('Wrong answer from server.')
      }
    }.bind(this),
  ],
  function(err, assetId) {
    if (err) {
      return callback(err)
    }
    var data = {
      userId : user.getId(),
      assetId : assetId,
    }
    return callback(null, data)
  })
}

Colu.prototype.registerUserByPhonenumber = function(registrationMessage, phonenumber, callback) {
  assertRegistrationMessage(registrationMessage)
  assert(phonenumber && typeof(phonenumber) == 'string', "No phonenumber.")
  assert.equal(typeof(callback), 'function', 'Need callback function as last (third) argument.')
  
  var user
  
  async.waterfall([
    function(cb) {
      registrationMessage.phonenumber = phonenumber;
      var url = coluHost + "/start_user_registration_to_company"
      request.post(url,
        {form: registrationMessage}, cb)
    },
    function (response, body, cb) {
      if (response.statusCode != 200) {
        return cb(body)
      }
      body = JSON.parse(body)
      
      user = this.parseRegistrationBody(body)
      if (user) {
        var client_public_key = user.getPublicKey()
        if (this.verifyMessage(registrationMessage, body.verified_client_signature, client_public_key, body.verified)) {
          username = getUsername(registrationMessage)
          accountIndex = this.hdwallet[registrationMessage.company_public_key].accountIndex
          return this.issueAndSend(username, accountIndex, user, cb)
        }
        else {
          cb('Signature not verified.')
        }
      }
      else {
        cb('Wrong answer from server.')
      }
    }.bind(this),
  ],
  function(err, assetId) {
    if (err) {
      return callback(err)
    }
    var data = {
      userId : user.getId(),
      assetId : assetId,
    }
    return callback(null, data)
  })
}

Colu.prototype.issueAndSend = function(username, accountIndex, user, callback) {
  var assetId
  var issuance
  async.waterfall([
    function(cb) {
      this.issue(username, accountIndex, 1, cb)
    }.bind(this),
    function(data, cb) {
      issuance = data
      console.log('data: '+JSON.stringify(data))
      var address = user.getAddress()
      getCCAddress(address, cb)
    },
    function(CCAddress, cb) {
      assetId = issuance.assetId
      this.send(CCAddress, accountIndex, assetId, 1, cb)
    }.bind(this),
    function(data, cb) {
      console.log('send data: '+data)
      cb(null, assetId)
    },
  ],
  callback)
}



Colu.prototype.parseRegistrationBody = function(body) {
  assert(body, 'Got error from server.')
  assert('extended_public_key' in body, 'No extended_public_key return from server.')
  assert('verified_client_signature' in body, 'No verified_client_signature return from server.')
  if (body && 'extended_public_key' in body) {
    return new User(body.extended_public_key)
  }
  return null
}

Colu.prototype.verifyUser = function(username, assetId, callback) {
  assert(username, 'Need username as first argument.')
  assert(assetId, 'Need assetId as second argument.')
  assert.equal(typeof(callback), 'function', 'Need callback function as last (fourth) argument.')
  
  var data_params = this.createRegistrationMessage(username)
  data_params.asset_id = assetId
  request.post(coluHost + "/verify_asset_holdings",
    {form: data_params },
    function (err, response, body) {
      if (err) {
        return callback(err)
      }
      if (response.statusCode != 200) {
        return callback(body)
      }
      body = JSON.parse(body)
      assert('client_public_key' in body, 'No client_public_key return from server.')
      assert('verified_client_signature' in body, 'No verified_client_signature return from server.')
      if (this.verifyMessage(data_params, body.verified_client_signature, body.client_public_key, body.verified)) {
        return callback(null, body)
      }
      else {
        callback('signature not verified')
      }
    }.bind(this)
  )
}

Colu.prototype.verifyMessage = function(registrationMessage, clientSignature, clientPublicKey, verified) {
  var message = registrationMessage.message
  var signature = registrationMessage.signature
  var clientAddress = registrationMessage.client_address
  var clientMessage = {
    message : message,
    signature : signature,
    verified : verified,
  }
  var clientMessageStr = JSON.stringify(clientMessage);
  var hash = crypto.createHash('sha256').update(clientMessageStr).digest()
  var publicKey = bitcoin.ECPubKey.fromHex(clientPublicKey)
  if (clientAddress) {
    return (publicKey.getAddress(this.network) == clientAddress) && ecdsa_verify(hash, clientSignature, publicKey)
  }
  return ecdsa_verify(hash, clientSignature, publicKey)
}

Colu.prototype.issue = function(username, account, amount, callback) {
  assert(this.needToDiscover, 'Account need to go through discovery process using this.discover(callback) method')
  assert(username, 'Need username as first argument.')
  assert(typeof(account) == 'number', 'Need account index as second argument.')
  if (typeof(amount) == 'function') {
    callback = amount
    amount = null
  }
  assert.equal(typeof(callback), 'function', 'Need callback function as last argument.')
  amount = amount || 1
  var attempts = 0
  var publicKey = this.getPublicKey(account)
  var assetInfo
  async.waterfall([
    // Ask for finance.
    function(callback) {
      var data_params = {
        company_public_key : publicKey.toHex(),
        purpose : 'Issue',
        amount : amount,
      }
      request.post(coluHost + "/dumb_finance",
      {form: data_params },
      callback)
    },
    function(response, body, callback) {
      if (response.statusCode != 200) {
        return callback(body)
      }
      body = JSON.parse(body)
      /*
      var txid = body.txid
      var index = body.index
      var return_address = body.return_address
      var return_fee = body.return_fee
      */
      return waitForBlock(callback)
    },
    function (blockHeight, callback) {
      return this.issueWithAttempts(publicKey, username, amount, 3, 60*1000, callback)
    }.bind(this),
    function (response, body, callback) {
      // body = JSON.parse(body)
      assetInfo = body
      var signedTxHex = signTx(body.txHex, this.getPrivateKey(account))
      var data_params = {
        tx_hex : signedTxHex,
      }
      request.post(coluHost + "/transmit",
      {form: data_params },
      callback)
    }.bind(this),
    function (response, body, callback) {
      if (response.statusCode != 200) {
        return callback(body)
      }
      body = JSON.parse(body)
      assetInfo.txid = body.transaction_hash
      assetInfo.signTxHex = body.transaction_hex
      callback(null, assetInfo)
    },
    ],
    callback
  )
}

Colu.prototype.atomicIssue = function (publicKey, username, amount, callback) {
  var data_params = {
    issue_adress: publicKey.getAddress(this.network).toString(),
    name: this.companyName+'_'+username,
    short_name: this.companyName+'_'+username,
    amount: ''+amount,
    fee: 1000,
    selfhost: false,
    metadata: {
      issuer: this.companyName,
      divisibility: 1,
      icon_url: "",
      image_url: "",
      version: "1.0",
      type: "AccessToken",
      description: username+' Identety token at: '+this.companyName
    },
  }
  
  request.post(coloredCoinsHost + "/issue",
    {form : data_params} ,
    callback)
}

Colu.prototype.issueWithAttempts = function(publicKey, username, amount, attempts, deley, callback) {
  this.atomicIssue(publicKey, username, amount, function(err, response, body) {
    if (err) return callback(err)
    
    if (response.statusCode != 200) {
      if (--attempts > 0) {
        console.log('Issue failed, trying another attempt.')
        return setTimeout(this.issueWithAttempts, deley, publicKey, username, amount, attempts, deley, callback)
      }
      return callback(body)
    }
    body = JSON.parse(body)
    if ('message' in body || 'error' in body) {
      if (--attempts > 0) {
        console.log('Issue failed, trying another attempt.')
        return setTimeout(this.issueWithAttempts, deley, publicKey, username, amount, attempts, deley, callback)
      }
      return callback(JSON.stringify(body))
    }
    return callback(err, response, body)
  })
}

Colu.prototype.send = function(address, account, assetId, amount, callback) {
  assert(this.needToDiscover, 'Account need to go through discovery process using this.discover(callback) method')
  assert(address, 'Need address as firdt argument.')
  assert(typeof(account) == 'number', 'Need account index as second argument.')
  assert(assetId, 'Need assetId as third argument.')
  if (typeof(amount) == 'function') {
    callback = amount
    amount = null
  }
  assert.equal(typeof(callback), 'function', 'Need callback function as last argument.')
  amount = amount || 1
  var attempts = 0
  var publicKey = this.getPublicKey(account)
  var sendInfo
  async.waterfall([
    // Ask for finance.
    function(callback) {
      var data_params = {
        company_public_key : publicKey.toHex(),
        purpose : 'Send',
        amount : amount,
      }
      request.post(coluHost + "/dumb_finance",
      {form: data_params },
      callback)
    },
    function(response, body, callback) {
      if (response.statusCode != 200) {
        return callback(body)
      }
      body = JSON.parse(body)
      /*
      var txid = body.txid
      var index = body.index
      var return_address = body.return_address
      var return_fee = body.return_fee
      */
      return waitForBlock(callback)
    },
    function (blockHeight, callback) {
      this.sendWithAttempts(publicKey, address, amount, assetId, 3, 60 * 1000, callback)
    }.bind(this),
    function (response, body, callback) {
      // body = JSON.parse(body)
      sendInfo = body
      var privateKey = this.getPrivateKey(account)
      console.log('private: '+privateKey.toWIF(this.network))
      var signedTxHex = signTx(body.txHex, privateKey)
      console.log('txHex: '+body.txHex)
      console.log('signedTxHex: '+signedTxHex)
      var data_params = {
        tx_hex : signedTxHex,
      }
      request.post(coluHost + "/transmit",
      {form: data_params },
      callback)
    }.bind(this),
    function (response, body, callback) {
      if (response.statusCode != 200) {
        return callback(body)
      }
      body = JSON.parse(body)
      if ('message' in body) {
        return callback(JSON.stringify(body))
      }
      sendInfo.txid = body.transaction_hash
      sendInfo.signTxHex = body.transaction_hex
      callback(null, sendInfo)
    },
    ],
    callback
  )
}

Colu.prototype.atomicSend = function (publicKey, address, amount, assetId, callback) {
  var fromAddress = publicKey.getAddress(this.network).toString()
  console.log('fromAddress: '+fromAddress)
  var data_params = {
    "fees": 1000,
    "from": fromAddress,
    "to": [
      {
        "address": address,
        "amount": amount,
        "asset_id": assetId
      }
    ]
  }
        
  request.post(coloredCoinsHost + "/sendasset",
    {form : data_params} ,
    callback)
}

Colu.prototype.sendWithAttempts = function(publicKey, address, amount, assetId, attempts, deley, callback) {
  this.atomicSend(publicKey, address, amount, assetId, function(err, response, body) {
    if (err) return callback(err)
    
    if (response.statusCode != 200) {
      if (--attempts > 0) {
        console.log('Sens failed, trying another attempt.')
        return setTimeout(this.sendWithAttempts, deley, publicKey, address, amount, assetId, attempts, deley, callback)
      }
      return callback(body)
    }
    body = JSON.parse(body)
    if ('message' in body || 'error' in body) {
      if (--attempts > 0) {
        console.log('Send failed, trying another attempt.')
        return setTimeout(this.sendWithAttempts, deley, publicKey, address, amount, assetId, attempts, deley, callback)
      }
      return callback(JSON.stringify(body))
    }
    return callback(err, response, body)
  })
}

function getUsername(registrationMessage) {
  assertRegistrationMessage(registrationMessage)
  var message = registrationMessage.message
  message = JSON.parse(message)
  var username = message.username
  return username
}

function isAddressActive(address, callback) {
  request.post(coluHost + "/is_address_active",
    {form: {address : address}},
    function (err, response, body) {
      if (err) {
        return callback(err)
      }
      if (response.statusCode != 200) {
        return callback(body)
      }
      body = JSON.parse(body)
      return callback(null, body)
    }
  )
}

function deriveAddress(master, accountIndex, addressIndex) {
  var node = master
  // BIP0044:
  // purpose'
  node = node.deriveHardened(44)
  // coin_type'
  node = node.deriveHardened(0)
  // account'
  node = node.deriveHardened(accountIndex)
  // change
  node = node.derive(0)
  // address_index
  node = node.derive(addressIndex)
  
  return node
}

function signTx(unsignedTx, privateKey) {
  var tx = bitcoin.Transaction.fromHex(unsignedTx)
  var insLength = tx.ins.length
  for (var i=0; i < insLength; i++) {
      tx.sign(i, privateKey)
  }
  return tx.toHex()
}

function assertRegistrationMessage(registrationMessage) {
  assert(registrationMessage, 'Need registrationMessage as first parameter, use createRegistrationMessage(username)')
  assert('message' in registrationMessage, 'registrationMessage not contains message, use createRegistrationMessage(username)')
  assert('company_public_key' in registrationMessage, 'registrationMessage not contains company_public_key, use createRegistrationMessage(username)')
  assert('signature' in registrationMessage, 'registrationMessage not contains signature, use createRegistrationMessage(username)')
  assert('company_name' in registrationMessage, 'registrationMessage not contains company_name, use createRegistrationMessage(username)')
}

function ecdsaSign(message, privateKey) {
  var shaMsg = crypto.createHash('sha256').update(message).digest()
  var signature = privateKey.sign(shaMsg)
  var signatureDER = signature.toDER()
  var signatureDERStr = signatureDER.toString('base64')
  return signatureDERStr
}

function ecdsa_verify(hash, signature, publicKey) {
  var sig_obj = bitcoin.ECSignature.fromDER(new Buffer(signature, 'base64'));
  return isValid = publicKey.verify(hash, sig_obj)
}

function waitForBlock(callback, lastBlock) {
  lastBlock = lastBlock || -1
  console.log('waiting (saw block '+lastBlock+')...')
  request.get(coluHost + "/get_last_block_height",
    function (err, response, body) {
      if (err) {
        return callback(err)
      }
      if (response.statusCode != 200) {
        return callback(body)
      }
      body = JSON.parse(body)
      var thisBlock = body.block_height
      if (lastBlock == -1) {
        lastBlock = thisBlock
      }
      if (lastBlock == thisBlock) {
        return setTimeout(waitForBlock, 60 * 1000, callback, lastBlock)
      }
      // Let flavi parse the new block
      return setTimeout(callback, 1.5 * 60 * 1000, null, thisBlock)
    }
  )
}

function getCCAddress(address, callback) {
  var data_params = {
    "address": address,
    "email": "string",
  }
        
  request.post(coloredCoinsHost + "/coloraddress",
    {form : data_params} ,
    function (err, response, body) {
      if (err) {
        return callback(err)
      }
      if (response.statusCode != 200) {
        return callback(body)
      }
      body = JSON.parse(body)
      return callback(null, body.adress)
    }
  )
}
