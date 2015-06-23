var bitcoin = require('bitcoinjs-lib')
var crypto = require('crypto')
var request = require('request')
var qr = require('qr-encode')
var assert = require('assert')
var async = require('async')
var crypto = require('crypto')
var redis = require('redis')
var User = require('./user.js')
var FileSystem = require('./filesystem.js')

// var coluHost = (properties && properties.colu_sdk && properties.colu_sdk.host) || 'https://dev.colu.co'
// var coluHost = 'http://localhost'
var coluHost = 'https://dev.colu.co'
var coloredCoinsHost = 'http://api.coloredcoins.org/v2'
// var coloredCoinsHost = 'http://10.0.0.25:8080/v2'

var MAX_EMPTY_ACCOUNTS = 3
var MAX_EMPTY_ADDRESSES = 3
var ASKING_INTERVAL = 4
// var NUM_OF_ATTEMPTS = 10

var FEE = 1000

module.exports = Colu

function Colu (companyName, network, privateSeed, redisPort, redisHost) {
  var self = this
  assert(companyName, 'Need company name as first argument.')
  self.companyName = companyName
  redisPort = redisPort || 6379
  redisHost = redisHost || '127.0.0.1'
  self.has_redis = false
  self.redisClient = redis.createClient(redisPort, redisHost)
  self.redisClient.on('error', function (err) {
    console.error('Redis err: ' + err)
    self.redisClient.end()
    self.has_redis = false
  })
  self.redisClient.on('connect', function () {
    console.log('redis connected!')
    self.has_redis = true
  })
  self.fs = new FileSystem()
  if (network && network.toLowerCase() === 'testnet') {
    self.network = bitcoin.networks.testnet
  } else {
    self.network = bitcoin.networks.bitcoin
  }
  if (!privateSeed) {
    self.privateSeed = crypto.randomBytes(32)
    self.needToDiscover = false
  } else {
    self.privateSeed = new Buffer(privateSeed, 'hex')
    self.needToDiscover = true
  }
  self.master = bitcoin.HDNode.fromSeedHex(self.privateSeed, self.network)
  self.nextAccount = 0
  self.hdwallet = {}
}

Colu.User = User

Colu.prototype.getNextAccount = function (callback) {
  var self = this
  // if (this.has_redis) {
  //   console.log('getNextAccount')
  return self.redisClient.get('coluSdkNextAccount', function (err, nextAccount) {
    if (err) {
      if (self.fs) {
        nextAccount = self.fs.get('coluSdkNextAccount') || 0
        return callback(nextAccount)
      } else {
        return callback(this.nextAccount)
      }
    } else {
      return callback(nextAccount)
    }
  })

  // } else {
  //   callback(this.nextAccount)
  // }
}

Colu.prototype.setNextAccount = function (nextAccount) {
  this.nextAccount = nextAccount
  if (this.has_redis) {
    this.redisClient.set('coluSdkNextAccount', this.nextAccount)
  } else {
    if (this.fs) {
      this.fs.set('coluSdkNextAccount', this.nextAccount)
    }
  }
}

Colu.init = function (companyName, network, privateSeed, redisPort, redisHost, callback) {
  if (typeof privateSeed === 'function') {
    callback = privateSeed
    privateSeed = null
  }

  if (typeof redisPort === 'function') {
    callback = redisPort
    redisPort = null
  }

  if (typeof redisHost === 'function') {
    callback = redisHost
    redisHost = null
  }

  var instance = new Colu(companyName, network, privateSeed, redisPort, redisHost)
  if (instance.needToDiscover) {
    instance.discover(function (err) {
      return callback(err, instance)
    })
  } else {
    return callback(null, instance)
  }
}

Colu.prototype.discover = function (callback) {
  this.getNextAccount(function (nextAccount) {
    this.nextAccount = nextAccount || 0
    var emptyAccounts = 0
    var currentAccount = nextAccount || 0
    async.whilst(
      function () { return emptyAccounts < MAX_EMPTY_ACCOUNTS },
      function (cb) {
        console.log('discovering account: ' + currentAccount)
        this.discoverAccount(currentAccount++, function (err, res) {
          if (err) return cb(err)
          if (res) {
            emptyAccounts = 0
            this.setNextAccount(currentAccount)
          } else {
            emptyAccounts++
          }
          cb()
        }.bind(this))
      }.bind(this),
      function (err) {
        if (err) return callback(err)
        this.needToDiscover = false
        callback()
      }.bind(this)
    )
  }.bind(this))
}

Colu.prototype.discoverAccount = function (accountIndex, callback) {
  var emptyAddresses = 0
  var currentAddresses = 0
  var active = false
  async.whilst(
    function () { return emptyAddresses < MAX_EMPTY_ADDRESSES },
    function (cb) {
      this.discoverAddresses(accountIndex, currentAddresses, ASKING_INTERVAL, function (err, res) {
        if (err) return cb(err)
        currentAddresses += ASKING_INTERVAL
        for (var i = 0; i < ASKING_INTERVAL; i++) {
          var address_obj = res[i]
          if (address_obj.active) {
            emptyAddresses = 0
            active = true
            console.log('active')
          } else {
            emptyAddresses++
            console.log('inactive')
          }
        }
        cb()
      })
    }.bind(this),
    function (err) {
      return callback(err, active)
    }
  )
}

Colu.prototype.discoverAddress = function (accountIndex, addressIndex, callback) {
  var hdnode = deriveAddress(this.master, accountIndex, addressIndex)
  var address = hdnode.getAddress().toString()
  console.log('discovering address: ' + address)
  isAddressActive(address, callback)
}

Colu.prototype.discoverAddresses = function (accountIndex, addressIndex, interval, callback) {
  var addresses = []
  for (var i = 0; i < interval; i++) {
    var hdnode = deriveAddress(this.master, accountIndex, addressIndex++)
    var address = hdnode.getAddress().toString()
    addresses.push(address)
    console.log('discovering address: ' + address)
  }
  isAddressesActive(addresses, callback)
}

Colu.prototype.getPrivateSeed = function () {
  return this.privateSeed.toString('hex')
}

Colu.prototype.createRegistrationMessage = function (username, account) {
  assert(username, 'Need username as first argument.')
  assert(this.needToDiscover === false, 'Account need to go through discovery process using this.discover(callback) method')
  var rand = crypto.randomBytes(10)
  rand = rand.toString('hex')
  rand = rand.toString('hex')
  var utcTS = Date.now().toString()
  var message = {
    username: username,
    timestamp: utcTS,
    rand: rand
  }
  var messageStr = JSON.stringify(message)
  var privateKey = this.getPrivateKey(account)
  var signature = ecdsaSign(messageStr, privateKey)
  var jsonSignature = JSON.stringify(signature)
  var publicKey = this.getPublicKey(account || this.nextAccount - 1)
  var registrationMessage = {
    message: messageStr,
    company_public_key: publicKey.toHex(),
    signature: jsonSignature,
    company_name: this.companyName
  }
  return registrationMessage
}

Colu.prototype.getPrivateKey = function (account, addressIndex) {
  if (typeof account === 'undefined') {
    account = account || this.nextAccount++
  }
  this.setNextAccount(this.nextAccount)
  addressIndex = addressIndex || 0
  var hdnode = deriveAddress(this.master, account, addressIndex)
  var privateKey = hdnode.privKey
  return privateKey
}

Colu.prototype.getPublicKey = function (account, addressIndex) {
  var privateKey = this.getPrivateKey(account, addressIndex)
  var publicKey = privateKey.pub
  this.hdwallet[publicKey.toHex()] = {
    accountIndex: account || this.nextAccount - 1,
    addressIndex: addressIndex || 0
  }
  return publicKey
}

Colu.prototype.createRegistrationQR = function (registrationMessage) {
  assertRegistrationMessage(registrationMessage)
  var dataURI = qr(JSON.stringify(registrationMessage), {type: 15, size: 10, level: 'L'})
  return dataURI
}

Colu.prototype.getRegistrationQR = function (registrationMessage, callback) {
  assertRegistrationMessage(registrationMessage)
  assert.equal(typeof callback, 'function', 'Need callback function as last (second) argument.')
  registrationMessage.by_code = true
  request.post(coluHost + '/start_user_registration_to_company',
    {form: registrationMessage },
    function (err, response, body) {
      if (err) {
        return callback(err)
      }
      if (response.statusCode !== 200) {
        return callback(body)
      }
      body = JSON.parse(body)
      if ('code' in body) {
        var simpleQrLink = coluHost + '/qr?code=' + body.code
        var dataURI = qr(simpleQrLink, {type: 5, size: 5, level: 'M'})
        callback(null, body.code, dataURI)
      } else {
        callback('No code returned from server')
      }
    }
  )
}

Colu.prototype.registerUser = function (registrationMessage, code, callback) {
  var self = this

  assertRegistrationMessage(registrationMessage)
  if (typeof code === 'function') {
    callback = code
    code = null
  }
  assert.equal(typeof callback, 'function', 'Need callback function as last argument.')
  var user
  var assetInfo
  async.waterfall([
    function (cb) {
      var url = coluHost + '/start_user_registration_to_company'
      var form
      if (code) {
        url = url + '_by_code'
        form = {code: code}
      } else {
        form = registrationMessage
      }
      request.post(
        url,
        {form: form},
        cb
      )
    },
    function (response, body, cb) {
      if (response.statusCode !== 200) {
        console.error('!!!!' + body)
        return cb(body)
      }
      body = JSON.parse(body)
      user = self.parseRegistrationBody(body)
      if (user) {
        var client_public_key = user.getRootPublicKey()
        if (self.verifyMessage(registrationMessage, body.verified_client_signature, client_public_key, body.verified)) {
//          var username = getUsername(registrationMessage)
          var accountIndex = self.hdwallet[registrationMessage.company_public_key].accountIndex
          return self.ccIssueFinanced(accountIndex, user, cb)
        } else {
          cb('Signature not verified.')
        }
      } else {
        cb('Wrong answer from server.')
      }
    },
    function (l_assetInfo, cb) {
      assetInfo = l_assetInfo
      assetInfo.userId = user.getId()
      var url = coluHost + '/finish_registration_to_company'
      request.post(
        url,
        {form: {asset_data: assetInfo}},
        cb
      )
    }
  ],
  function (err, res) {
    if (err) {
      return callback(err)
    }
    return callback(null, assetInfo)
  })
}

Colu.prototype.registerUserByPhonenumber = function (registrationMessage, phonenumber, callback) {
  assertRegistrationMessage(registrationMessage)
  assert(phonenumber && typeof phonenumber === 'string', 'No phonenumber.')
  assert.equal(typeof callback, 'function', 'Need callback function as last (third) argument.')
  var self = this

  var user
  var assetInfo

  async.waterfall([
    function (cb) {
      registrationMessage.phonenumber = phonenumber
      var url = coluHost + '/start_user_registration_to_company'
      request.post(url,
        {form: registrationMessage}, cb)
    },
    function (response, body, cb) {
      if (response.statusCode !== 200) {
        return cb(body)
      }
      body = JSON.parse(body)

      user = self.parseRegistrationBody(body)
      if (user) {
        var client_public_key = user.getRootPublicKey()
        if (self.verifyMessage(registrationMessage, body.verified_client_signature, client_public_key, body.verified)) {
//          var username = getUsername(registrationMessage)
          var accountIndex = self.hdwallet[registrationMessage.company_public_key].accountIndex
          return self.ccIssueFinanced(accountIndex, user, cb)
        } else {
          cb('Signature not verified.')
        }
      } else {
        cb('Wrong answer from server.')
      }
    },
    function (l_assetInfo, cb) {
      assetInfo = l_assetInfo
      assetInfo.userId = user.getId()
      var url = coluHost + '/finish_registration_to_company'
      request.post(
        url,
        {form: {asset_data: assetInfo}},
        cb
      )
    }
  ],
  function (err, res) {
    if (err) {
      return callback(err)
    }
    return callback(null, assetInfo)
  })
}

// --------------------------------------------------------------------------------------------------

// Colu.prototype.issueAndSend = function (username, accountIndex, user, callback) {
//   var assetId
//   var issuance
//   var address = user.getAddress()
//   console.log('sending to address: ' + address)
//   async.waterfall([
//     function (cb) {
//       this.issue(username, accountIndex, 1, cb)
//     }.bind(this),
//     function (data, cb) {
//       issuance = data
//       console.log('data: ' + JSON.stringify(data))
//       getCCAddress(address, cb)
//     },
//     function (CCAddress, cb) {
//       assetId = issuance.assetId
//       this.send(CCAddress, accountIndex, issuance, 1, cb)
//     }.bind(this),
//     // TODO: Financing the receiving address for debug purpose --- need to be removed.
//     function (data, cb) {
//       console.log('send data: ' + data)
//       var data_params = {
//         company_public_key: user.getPublicKey(),
//         purpose: 'Issue',
//         amount: 1
//       }
//       request.post(coluHost + '/dumb_finance',
//       {form: data_params },
//       cb)
//     },
//     function (response, body, cb) {
//       if (response.statusCode !== 200) {
//         return cb(body)
//       }
//       cb(null, assetId)
//     }
//   ],
//   callback)
// }

Colu.prototype.parseRegistrationBody = function (body) {
  assert(body, 'Got error from server.')
  assert('extended_public_key' in body, 'No extended_public_key return from server.')
  assert('verified_client_signature' in body, 'No verified_client_signature return from server.')
  if (body && 'extended_public_key' in body) {
    return new User(body.extended_public_key)
  }
  return null
}

Colu.prototype.verifyUser = function (username, assetId, callback) {
  assert(username, 'Need username as first argument.')
  assert(assetId, 'Need assetId as second argument.')
  assert.equal(typeof callback, 'function', 'Need callback function as last (fourth) argument.')

  var data_params = this.createRegistrationMessage(username)
  data_params.asset_id = assetId
  request.post(coluHost + '/verify_asset_holdings',
    {form: data_params },
    function (err, response, body) {
      if (err) {
        return callback(err)
      }
      if (response.statusCode !== 200) {
        return callback(body)
      }
      body = JSON.parse(body)
      assert('client_public_key' in body, 'No client_public_key return from server.')
      assert('verified_client_signature' in body, 'No verified_client_signature return from server.')
      if (this.verifyMessage(data_params, body.verified_client_signature, body.client_public_key, body.verified)) {
        return callback(null, body)
      } else {
        callback('signature not verified')
      }
    }.bind(this)
  )
}

Colu.prototype.verifyMessage = function (registrationMessage, clientSignature, clientPublicKey, verified) {
  var message = registrationMessage.message
  var signature = registrationMessage.signature
  var clientAddress = registrationMessage.client_address
  var clientMessage = {
    message: message,
    signature: signature,
    verified: verified
  }
  var clientMessageStr = JSON.stringify(clientMessage)
  var hash = crypto.createHash('sha256').update(clientMessageStr).digest()
  var publicKey = bitcoin.ECPubKey.fromHex(clientPublicKey)
  if (clientAddress) {
    return (publicKey.getAddress(this.network) === clientAddress) && ecdsa_verify(hash, clientSignature, publicKey)
  }
  return ecdsa_verify(hash, clientSignature, publicKey)
}

// Colu.prototype.issue = function (username, account, amount, callback) {
//   assert(this.needToDiscover === false, 'Account need to go through discovery process using this.discover(callback) method')
//   assert(username, 'Need username as first argument.')
//   assert(typeof account === 'number', 'Need account index as second argument.')
//   if (typeof amount === 'function') {
//     callback = amount
//     amount = null
//   }
//   assert.equal(typeof callback, 'function', 'Need callback function as last argument.')
//   amount = amount || 1
//   // var attempts = 0
//   var publicKey = this.getPublicKey(account)
//   var assetInfo
//   async.waterfall([
//     // Ask for finance.
//     function (callback) {
//       var data_params = {
//         company_public_key: publicKey.toHex(),
//         purpose: 'Issue',
//         amount: amount
//       }
//       request.post(coluHost + '/dumb_finance',
//       {form: data_params },
//       callback)
//     },
//     function (response, body, callback) {
//       if (response.statusCode !== 200) {
//         return callback(body)
//       }
//       body = JSON.parse(body)
//       return waitForConfirmation([body.txid], callback)
//     },
//     function (callback) {
//       return this.issueWithAttempts(publicKey, username, amount, NUM_OF_ATTEMPTS, 60 * 1000, callback)
//     }.bind(this),
//     function (response, body, callback) {
//       // body = JSON.parse(body)
//       assetInfo = body
//       var signedTxHex = signTx(body.txHex, this.getPrivateKey(account))
//       var data_params = {
//         tx_hex: signedTxHex
//       }
//       request.post(coluHost + '/transmit',
//       {form: data_params },
//       callback)
//     }.bind(this),
//     function (response, body, callback) {
//       if (response.statusCode !== 200) {
//         return callback(body)
//       }
//       body = JSON.parse(body)
//       assetInfo.txid = body.transaction_hash
//       assetInfo.signTxHex = body.transaction_hex
//       callback(null, assetInfo)
//     }
//     ],
//     callback
//   )
// }

Colu.prototype.ccIssueFinanced = function (account, user, callback) {
  assert(this.needToDiscover === false, 'Account need to go through discovery process using this.discover(callback) method')
  var toAddress = user.getAddress()
  var publicKey = this.getPublicKey(account)
  var assetInfo
  var last_txid
  async.waterfall([
    // Ask for finance.
    function (cb) {
      console.log('asking for money')
      var data_params = {
        company_public_key: publicKey.toHex(),
        purpose: 'Issue',
        amount: 1800 // TODO: calc min dust
      }
      request.post(coluHost + '/ask_for_finance',
      {form: data_params },
      cb)
    },
    function (response, body, cb) {
      if (response.statusCode !== 200) {
        return cb(body)
      }
      console.log('got money')
      body = JSON.parse(body)
      last_txid = body.txid
      return this.accessCCIssue(publicKey, toAddress, body.txid, body.vout, cb)
    }.bind(this),
    function (response, body, cb) {
      if (response.statusCode !== 200) {
        console.log('?????' + body)
        return cb(body)
      }
      console.log('got issue tx')
      console.log(body)
      body = JSON.parse(body)
      assetInfo = body
      var signedTxHex = signTx(body.txHex, this.getPrivateKey(account))
      console.log('signTx: ' + signedTxHex)
      var data_params = {
        last_txid: last_txid,
        tx_hex: signedTxHex
      }
      request.post(coluHost + '/transmit_financed',
      {form: data_params },
      cb)
    }.bind(this),
    function (response, body, cb) {
      if (response.statusCode !== 200) {
        return cb(body)
      }
      console.log('transmited')
      body = JSON.parse(body)
      assetInfo.txid = body.txid2
      cb(null, assetInfo)
    }
    ],
    callback
  )
}

// Colu.prototype.genericIssue = function (publicKey, assetname, assetshortname, amount, fee, selfhost, devis, image, icon, version, type, desc, usermeta, callback) {
//   assert(typeof devis === 'number' && parseInt(devis) === devis && devis >= 0 && devis <= 8, 'Devisibility must be an integer number between 0 and 8')
//   amount = '' + amount
//   type = '' + type
//   desc = '' + desc
//   assetname = '' + assetname
//   assetshortname = '' + assetshortname
//   fee = fee || 1000
//   selfhost = selfhost || false

//   var data_params = {
//     issue_adress: publicKey.getAddress(this.network).toString(),
//     name: assetname,
//     short_name: assetshortname,
//     amount: amount,
//     fee: fee,
//     selfhost: selfhost,
//     metadata: {
//       issuer: this.companyName,
//       divisibility: devis,
//       icon_url: icon,
//       image_url: image,
//       version: version,
//       type: type,
//       description: desc,
//       user_metadata: usermeta
//     }
//   }

//   request.post(coloredCoinsHost + '/issue',
//     {form: data_params},
//     callback)
// }

Colu.prototype.ccIssue = function (args, callback) {
  var data_params = {
    issueAddress: args.issueAddress || null,
    amount: args.amount || 1,
    fee: args.fee || FEE,
    reissueable: args.reissueable || false,
    flags: {
      injectPreviousOutput: (args.injectPreviousOutput) === false ? false : true
    },
    divisibility: args.divisibility || 0,
    transfer: [
      {
        address: args.toAddress || null,
        amount: args.toAmount || 1
      }
    ],
    financeOutput: args.financeOutput,
    financeOutputTxid: args.financeOutputTxid
  }
  if (args.transfers) {
    data_params.transfer = args.transfers
  }
  return request.post(coloredCoinsHost + '/issue',
    {form: data_params},
    callback)
}

Colu.prototype.accessCCIssue = function (publicKey, toAddress, txid, vout, callback) {
  var self = this
  console.log(publicKey.getAddress(this.network).toString())
  var args = {
    issueAddress: publicKey.getAddress(this.network).toString(),
    amount: 1,
    reissueable: true,
    injectPreviousOutput: true,
    divisibility: 0,
    toAddress: toAddress,
    toAmount: 1,
    financeOutputTxid: txid,
    financeOutput: vout
  }
  return self.ccIssue(args, callback)
}

// Colu.prototype.atomicIssue = function (publicKey, username, amount, callback) {
//   amount = '' + amount
//   var data_params = {
//     issue_adress: publicKey.getAddress(this.network).toString(),
//     name: this.companyName + '_' + username,
//     short_name: this.companyName + '_' + username,
//     amount: amount,
//     fee: 1000,
//     selfhost: false,
//     metadata: {
//       issuer: this.companyName,
//       divisibility: 0,
//       icon_url: '',
//       image_url: '',
//       version: '1.0',
//       type: 'AccessToken',
//       description: username + ' Identety token at: ' + this.companyName
//     }
//   }

//   request.post(coloredCoinsHost + '/issue',
//     {form: data_params},
//     callback)
// }

// Colu.prototype.issueWithAttempts = function (publicKey, username, amount, attempts, deley, callback) {
//   this.atomicIssue(publicKey, username, amount, function (err, response, body) {
//     if (err) return callback(err)

//     if (response.statusCode !== 200) {
//       if (--attempts > 0) {
//         console.log('Issue failed, trying another attempt.')
//         return setTimeout(this.issueWithAttempts.bind(this), deley, publicKey, username, amount, attempts, deley, callback)
//       }
//       return callback(body)
//     }
//     body = JSON.parse(body)
//     if ('message' in body || 'error' in body) {
//       if (--attempts > 0) {
//         console.log('Issue failed, trying another attempt.')
//         return setTimeout(this.issueWithAttempts.bind(this), deley, publicKey, username, amount, attempts, deley, callback)
//       }
//       return callback(JSON.stringify(body))
//     }
//     return callback(err, response, body)
//   }.bind(this))
// }

Colu.prototype.ccSend = function (args, callback) {
  var data_params = {
    fee: args.fee || FEE,
    from: args.from || null,
    transfer: [
      {
        address: args.toAddress || null,
        amount: args.toAmount || 1,
        assetId: args.toAssetId || null
      }
    ],
    flags: {
      injectPreviousOutput: (args.injectPreviousOutput) === false ? false : true
    },
    financeOutput: args.financeOutput,
    financeOutputTxid: args.financeOutputTxid
  }
  if (args.to) {
    data_params.to = args.to
  }
  return request.post(coloredCoinsHost + '/send',
    {form: data_params},
    callback)
}

Colu.prototype.ccSendFinanced = function (account, toAddress, assetId, amount, callback) {
  var self = this
  assert(self.needToDiscover === false, 'Account need to go through discovery process using this.discover(callback) method')
  var publicKey = self.getPublicKey(account)
  var sendInfo
  var lastTxid
  async.waterfall([
    // Ask for finance.
    function (callback) {
      var data_params = {
        company_public_key: publicKey.toHex(),
        purpose: 'Send',
        amount: 1800 // TODO: calc min dust
      }
      request.post(coluHost + '/ask_for_finance',
      {form: data_params },
      callback)
    },
    function (response, body, callback) {
      if (response.statusCode !== 200) {
        return callback(body)
      }
      body = JSON.parse(body)
      lastTxid = body.txid

      var sendArgs = {
        fee: FEE,
        from: publicKey.getAddress(self.network).toString(),
        toAddress: toAddress,
        toAmount: amount,
        toAssetId: assetId,
        financeOutput: body.vout,
        financeOutputTxid: body.txid
      }
      return self.ccSend(sendArgs, callback)
    },
    function (response, body, callback) {
      if (response.statusCode !== 200) {
        return callback(body)
      }
      console.log(body)
      body = JSON.parse(body)
      sendInfo = body
      var signedTxHex = signTx(body.txHex, self.getPrivateKey(account))
      console.log('signTx: ' + signedTxHex)
      var data_params = {
        last_txid: lastTxid,
        tx_hex: signedTxHex
      }
      request.post(coluHost + '/transmit_financed',
      {form: data_params },
      callback)
    },
    function (response, body, callback) {
      if (response.statusCode !== 200) {
        return callback(body)
      }
      body = JSON.parse(body)
      sendInfo.txid = body.txid2
      callback(null, sendInfo)
    }
    ],
    callback
  )
}

// Colu.prototype.send = function (address, account, assetId, amount, callback) {
//   assert(this.needToDiscover === false, 'Account need to go through discovery process using this.discover(callback) method')
//   assert(address, 'Need address as firdt argument.')
//   assert(typeof account === 'number', 'Need account index as second argument.')
//   assert(assetId, 'Need assetId as third argument.')
//   if (typeof amount === 'function') {
//     callback = amount
//     amount = null
//   }
//   assert.equal(typeof callback, 'function', 'Need callback function as last argument.')
//   amount = amount || 1
//   var issuance
//   if (typeof assetId !== 'string' && 'assetId' in assetId) {
//     issuance = assetId
//     assetId = issuance.assetId
//   }

//   var attempts = 0
//   var publicKey = this.getPublicKey(account)
//   var sendInfo
//   async.waterfall([
//     // Ask for finance.
//     function (callback) {
//       var data_params = {
//         company_public_key: publicKey.toHex(),
//         purpose: 'Send',
//         amount: amount
//       }
//       request.post(coluHost + '/dumb_finance',
//       {form: data_params },
//       callback)
//     },
//     function (response, body, callback) {
//       if (response.statusCode !== 200) {
//         return callback(body)
//       }
//       body = JSON.parse(body)
//       var txids = [body.txid]
//       if (issuance && 'transaction_hash' in issuance) {
//         txids.push(issuance.transaction_hash)
//       } else if (issuance && 'txid' in issuance) {
//         txids.push(issuance.txid)
//       }
//       return waitForConfirmation(txids, callback)
//     },
//     function (callback) {
//       this.sendWithAttempts(publicKey, address, amount, assetId, NUM_OF_ATTEMPTS, 60 * 1000, callback)
//     }.bind(this),
//     function (response, body, callback) {
//       // body = JSON.parse(body)
//       sendInfo = body
//       var privateKey = this.getPrivateKey(account)
//       var signedTxHex = signTx(body.txHex, privateKey)
//       var data_params = {
//         tx_hex: signedTxHex
//       }
//       request.post(coluHost + '/transmit',
//       {form: data_params },
//       callback)
//     }.bind(this),
//     function (response, body, callback) {
//       if (response.statusCode !== 200) {
//         return callback(body)
//       }
//       body = JSON.parse(body)
//       if ('message' in body) {
//         return callback(JSON.stringify(body))
//       }
//       sendInfo.txid = body.transaction_hash
//       sendInfo.signTxHex = body.transaction_hex
//       callback(null, sendInfo)
//     }
//     ],
//     callback
//   )
// }

// Colu.prototype.atomicSend = function (publicKey, address, amount, assetId, callback) {
//   amount = '' + amount
//   var fromAddress = publicKey.getAddress(this.network).toString()
//   var data_params = {
//     'fees': 1000,
//     'from': fromAddress,
//     'to': [
//       {
//         'address': address,
//         'amount': amount,
//         'asset_id': assetId
//       }
//     ]
//   }

//   request.post(coloredCoinsHost + '/sendasset',
//     {form: data_params},
//     callback)
// }

// Colu.prototype.sendWithAttempts = function (publicKey, address, amount, assetId, attempts, deley, callback) {
//   this.atomicSend(publicKey, address, amount, assetId, function (err, response, body) {
//     if (err) return callback(err)

//     if (response.statusCode !== 200) {
//       if (--attempts > 0) {
//         console.log('Send failed, trying another attempt.')
//         return setTimeout(this.sendWithAttempts.bind(this), deley, publicKey, address, amount, assetId, attempts, deley, callback)
//       }
//       return callback(body)
//     }
//     body = JSON.parse(body)
//     if ('message' in body || 'error' in body) {
//       if (--attempts > 0) {
//         console.log('Send failed, trying another attempt.')
//         return setTimeout(this.sendWithAttempts.bind(this), deley, publicKey, address, amount, assetId, attempts, deley, callback)
//       }
//       return callback(JSON.stringify(body))
//     }
//     return callback(err, response, body)
//   }.bind(this))
// }

Colu.prototype.getUsername = function (registrationMessage) {
  assertRegistrationMessage(registrationMessage)
  var message = registrationMessage.message
  message = JSON.parse(message)
  var username = message.username
  return username
}

function isAddressActive (address, callback) {
  request.post(coluHost + '/is_address_active',
    {form: {address: address}},
    function (err, response, body) {
      if (err) {
        return callback(err)
      }
      if (response.statusCode !== 200) {
        return callback(body)
      }
      body = JSON.parse(body)
      return callback(null, body)
    }
  )
}

function isAddressesActive (addresses, callback) {
  request.post(coluHost + '/is_addresses_active',
    {form: {addresses: addresses}},
    function (err, response, body) {
      if (err) {
        return callback(err)
      }
      if (response.statusCode !== 200) {
        return callback(body)
      }
      body = JSON.parse(body)
      return callback(null, body)
    }
  )
}

function deriveAddress (master, accountIndex, addressIndex) {
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

function signTx (unsignedTx, privateKey) {
  var tx = bitcoin.Transaction.fromHex(unsignedTx)
  var insLength = tx.ins.length
  for (var i = 0; i < insLength; i++) {
    tx.sign(i, privateKey)
  }
  return tx.toHex()
}

function assertRegistrationMessage (registrationMessage) {
  assert(registrationMessage, 'Need registrationMessage as first parameter, use createRegistrationMessage(username)')
  assert('message' in registrationMessage, 'registrationMessage not contains message, use createRegistrationMessage(username)')
  assert('company_public_key' in registrationMessage, 'registrationMessage not contains company_public_key, use createRegistrationMessage(username)')
  assert('signature' in registrationMessage, 'registrationMessage not contains signature, use createRegistrationMessage(username)')
  assert('company_name' in registrationMessage, 'registrationMessage not contains company_name, use createRegistrationMessage(username)')
}

function ecdsaSign (message, privateKey) {
  var shaMsg = crypto.createHash('sha256').update(message).digest()
  var signature = privateKey.sign(shaMsg)
  var signatureDER = signature.toDER()
  var signatureDERStr = signatureDER.toString('base64')
  return signatureDERStr
}

function ecdsa_verify (hash, signature, publicKey) {
  var sig_obj = bitcoin.ECSignature.fromDER(new Buffer(signature, 'base64'))
  var isValid = publicKey.verify(hash, sig_obj)
  return isValid
}

function waitForBlock (callback, lastBlock) {
  lastBlock = lastBlock || -1
  console.log('waiting (saw block ' + lastBlock + ')...')
  request.get(coluHost + '/get_last_block_height',
    function (err, response, body) {
      if (err) {
        return callback(err)
      }
      if (response.statusCode !== 200) {
        return callback(body)
      }
      body = JSON.parse(body)
      var thisBlock = body.block_height
      if (lastBlock === -1) {
        lastBlock = thisBlock
      }
      if (lastBlock === thisBlock) {
        return setTimeout(waitForBlock, 60 * 1000, callback, lastBlock)
      }
      // Let flavi parse the new block
      return setTimeout(callback, 1.5 * 60 * 1000, null, thisBlock)
    }
  )
}

function waitForConfirmation (txids, callback) {
  if (txids.length === 0) {
    return callback()
  }
  request.post(coluHost + '/get_transactions',
    {form: {txids: txids}},
    function (err, response, body) {
      if (err) {
        return callback(err)
      }
      if (response.statusCode !== 200) {
        return callback(body)
      }
      body = JSON.parse(body)
      async.eachSeries(body, function (tx, cb) {
        if (tx.confirmations) {
          console.log('tx ' + tx.txid + ' confdirmed with ' + tx.confirmations + ' confirmations.')
          var index = txids.indexOf(tx.txid)
          if (index > -1) {
            txids.splice(index, 1)
          }
        }
        cb()
      },
      function (err) {
        if (err) return callback(err)
        if (txids.length === 0) {
          console.log('All txs confdirmed')
          return callback()
        }
        console.log('Waiting 1 minute and trying again (for confirmations).')
        return setTimeout(waitForConfirmation, 60 * 1000, txids, callback)
      })
    }
  )
}

// function getCCAddress (address, callback) {
//   var data_params = {
//     'address': address,
//     'email': 'string'
//   }

//   request.post(coloredCoinsHost + '/coloraddress',
//     {form: data_params},
//     function (err, response, body) {
//       if (err) {
//         return callback(err)
//       }
//       if (response.statusCode !== 200) {
//         return callback(body)
//       }
//       body = JSON.parse(body)
//       return callback(null, body.adress)
//     }
//   )
// }
