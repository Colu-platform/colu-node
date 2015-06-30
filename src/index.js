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

var coluHost = 'https://dev.engine.colu.co'
var coloredCoinsHost = 'http://api.coloredcoins.org/v2'

var MAX_EMPTY_ACCOUNTS = 3
var MAX_EMPTY_ADDRESSES = 3
var ASKING_INTERVAL = 4
// var NUM_OF_ATTEMPTS = 10

var FEE = 1000

module.exports = Colu

function Colu (companyName, network, privateSeed, redisPort, redisHost) {
  var self = this
  assert(companyName, 'Need company name as first argument.')
  self.coluHost = coluHost
  self.coloredCoinsHost = coloredCoinsHost
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
  var self = this
  self.nextAccount = nextAccount
  if (self.has_redis) {
    self.redisClient.set('coluSdkNextAccount', self.nextAccount)
  } else {
    if (self.fs) {
      self.fs.set('coluSdkNextAccount', self.nextAccount)
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
  var self = this
  self.getNextAccount(function (nextAccount) {
    self.nextAccount = nextAccount || 0
    var emptyAccounts = 0
    var currentAccount = nextAccount || 0
    async.whilst(
      function () { return emptyAccounts < MAX_EMPTY_ACCOUNTS },
      function (cb) {
        console.log('discovering account: ' + currentAccount)
        self.discoverAccount(currentAccount++, function (err, res) {
          if (err) return cb(err)
          if (res) {
            emptyAccounts = 0
            self.setNextAccount(currentAccount)
          } else {
            emptyAccounts++
          }
          cb()
        })
      },
      function (err) {
        if (err) return callback(err)
        self.needToDiscover = false
        callback()
      }
    )
  })
}

Colu.prototype.discoverAccount = function (accountIndex, callback) {
  var self = this
  var emptyAddresses = 0
  var currentAddresses = 0
  var active = false
  async.whilst(
    function () { return emptyAddresses < MAX_EMPTY_ADDRESSES },
    function (cb) {
      self.discoverAddresses(accountIndex, currentAddresses, ASKING_INTERVAL, function (err, res) {
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
    },
    function (err) {
      return callback(err, active)
    }
  )
}

Colu.prototype.discoverAddress = function (accountIndex, addressIndex, callback) {
  var self = this
  var hdnode = deriveAddress(self.master, accountIndex, addressIndex)
  var address = hdnode.getAddress().toString()
  console.log('discovering address: ' + address)
  self.isAddressActive(address, callback)
}

Colu.prototype.discoverAddresses = function (accountIndex, addressIndex, interval, callback) {
  var self = this
  var addresses = []
  for (var i = 0; i < interval; i++) {
    var hdnode = deriveAddress(self.master, accountIndex, addressIndex++)
    var address = hdnode.getAddress().toString()
    addresses.push(address)
    console.log('discovering address: ' + address)
  }
  self.isAddressesActive(addresses, callback)
}

Colu.prototype.getPrivateSeed = function () {
  var self = this
  return self.privateSeed.toString('hex')
}

Colu.prototype.createRegistrationMessage = function (username, account) {
  var self = this
  assert(username, 'Need username as first argument.')
  assert(self.needToDiscover === false, 'Account need to go through discovery process using colu.discover(callback) method')
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
  var privateKey = self.getPrivateKey(account)
  var signature = ecdsaSign(messageStr, privateKey)
  var jsonSignature = JSON.stringify(signature)
  var publicKey = self.getPublicKey(account || self.nextAccount - 1)
  var registrationMessage = {
    message: messageStr,
    company_public_key: publicKey.toHex(),
    signature: jsonSignature,
    company_name: self.companyName
  }
  return registrationMessage
}

Colu.prototype.getPrivateKey = function (account, addressIndex) {
  var self = this
  if (typeof account === 'undefined') {
    account = account || self.nextAccount++
  }
  self.setNextAccount(self.nextAccount)
  addressIndex = addressIndex || 0
  var hdnode = deriveAddress(self.master, account, addressIndex)
  var privateKey = hdnode.privKey
  return privateKey
}

Colu.prototype.getPublicKey = function (account, addressIndex) {
  var self = this
  var privateKey = self.getPrivateKey(account, addressIndex)
  var publicKey = privateKey.pub
  self.hdwallet[publicKey.toHex()] = {
    accountIndex: account || self.nextAccount - 1,
    addressIndex: addressIndex || 0
  }
  return publicKey
}

Colu.prototype.createRegistrationQR = function (registrationMessage) {
  // var self = this
  assertRegistrationMessage(registrationMessage)
  var dataURI = qr(JSON.stringify(registrationMessage), {type: 15, size: 10, level: 'L'})
  return dataURI
}

Colu.prototype.getRegistrationQR = function (registrationMessage, callback) {
  var self = this
  assertRegistrationMessage(registrationMessage)
  assert.equal(typeof callback, 'function', 'Need callback function as last (second) argument.')
  registrationMessage.by_code = true
  request.post(self.coluHost + '/start_user_registration_to_company',
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
        var simpleQrLink = self.coluHost + '/qr?code=' + body.code
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
      var url = self.coluHost + '/start_user_registration_to_company'
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
        return cb(new Error(body))
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
      var url = self.coluHost + '/finish_registration_to_company'
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
  var self = this
  assertRegistrationMessage(registrationMessage)
  assert(phonenumber && typeof phonenumber === 'string', 'No phonenumber.')
  assert.equal(typeof callback, 'function', 'Need callback function as last (third) argument.')

  var user
  var assetInfo

  async.waterfall([
    function (cb) {
      registrationMessage.phonenumber = phonenumber
      var url = self.coluHost + '/start_user_registration_to_company'
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
      var url = self.coluHost + '/finish_registration_to_company'
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

Colu.prototype.issueGenericAsset = function (userExtendedKey, assetData, callback) {
  var self = this
  var user = new User(userExtendedKey)
  var accountIndex = self.hdwallet[self.getPublicKey(self.nextAccount - 1).toHex()].accountIndex
  return self.ccIssueFinanced(accountIndex, user, assetData, callback)
}

Colu.prototype.parseRegistrationBody = function (body) {
  // var self = this
  assert(body, 'Got error from server.')
  assert('extended_public_key' in body, 'No extended_public_key return from server.')
  assert('verified_client_signature' in body, 'No verified_client_signature return from server.')
  if (body && 'extended_public_key' in body) {
    return new User(body.extended_public_key)
  }
  return null
}

Colu.prototype.verifyUser = function (username, assetId, callback) {
  var self = this
  assert(username, 'Need username as first argument.')
  assert(assetId, 'Need assetId as second argument.')
  assert.equal(typeof callback, 'function', 'Need callback function as last (fourth) argument.')

  var data_params = self.createRegistrationMessage(username)
  data_params.asset_id = assetId
  request.post(self.coluHost + '/verify_asset_holdings',
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
      if (self.verifyMessage(data_params, body.verified_client_signature, body.client_public_key, body.verified)) {
        return callback(null, body)
      } else {
        callback('signature not verified')
      }
    }
  )
}

Colu.prototype.verifyMessage = function (registrationMessage, clientSignature, clientPublicKey, verified) {
  var self = this
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
    return (publicKey.getAddress(self.network) === clientAddress) && ecdsa_verify(hash, clientSignature, publicKey)
  }
  return ecdsa_verify(hash, clientSignature, publicKey)
}

Colu.prototype.ccIssueFinanced = function (account, user, assetData, callback) {
  if (typeof assetData === 'function') {
    callback = assetData
    assetData = null
  }
  var self = this
  assert(self.needToDiscover === false, 'Account need to go through discovery process using colu.discover(callback) method')
  var toAddress = user.getAddress()
  var publicKey = self.getPublicKey(account)
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
      request.post(self.coluHost + '/ask_for_finance',
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
      if (!assetData) return self.accessCCIssue(publicKey, toAddress, body.txid, body.vout, cb)
      return self.genericCCIssue(publicKey, toAddress, body.txid, body.vout, assetData, cb)
    },
    function (response, body, cb) {
      if (response.statusCode !== 200) {
        return cb(body)
      }
      console.log('got issue tx')
      console.log(body)
      body = JSON.parse(body)
      assetInfo = body
      var signedTxHex = signTx(body.txHex, self.getPrivateKey(account))
      console.log('signTx: ' + signedTxHex)
      var data_params = {
        last_txid: last_txid,
        tx_hex: signedTxHex
      }
      request.post(self.coluHost + '/transmit_financed',
      {form: data_params },
      cb)
    },
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

Colu.prototype.ccIssue = function (args, callback) {
  var self = this
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
    financeOutputTxid: args.financeOutputTxid,
    metadata: args.metadata
  }
  if (args.transfers) {
    data_params.transfer = args.transfers
  }
  return request.post(self.coloredCoinsHost + '/issue',
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

Colu.prototype.genericCCIssue = function (publicKey, toAddress, txid, vout, assetData, callback) {
  var self = this
  console.log(publicKey.getAddress(this.network).toString())
  var args = {
    issueAddress: publicKey.getAddress(this.network).toString(),
    amount: assetData.amount,
    reissueable: assetData.reissueable,
    injectPreviousOutput: assetData.injectPreviousOutput,
    divisibility: assetData.divisibility,
    toAddress: toAddress,
    toAmount: assetData.amount,
    financeOutputTxid: txid,
    financeOutput: vout,
    metadata: assetData.metadata
  }
  return self.ccIssue(args, callback)
}

Colu.prototype.ccSend = function (args, callback) {
  var self = this
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
  return request.post(self.coloredCoinsHost + '/send',
    {form: data_params},
    callback)
}

Colu.prototype.ccSendFinanced = function (account, toAddress, assetId, amount, callback) {
  var self = this
  assert(self.needToDiscover === false, 'Account need to go through discovery process using colu.discover(callback) method')
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
      request.post(self.coluHost + '/ask_for_finance',
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
      request.post(self.coluHost + '/transmit_financed',
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

Colu.prototype.getUsername = function (registrationMessage) {
  // var self = this
  assertRegistrationMessage(registrationMessage)
  var message = registrationMessage.message
  message = JSON.parse(message)
  var username = message.username
  return username
}

Colu.prototype.isAddressActive = function (address, callback) {
  var self = this
  request.post(self.coluHost + '/is_address_active',
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

Colu.prototype.isAddressesActive = function (addresses, callback) {
  var self = this
  request.post(self.coluHost + '/is_addresses_active',
    {form: {addresses: addresses}},
    function (err, response, body) {
      if (err) {
        return callback(err)
      }
      if (response.statusCode !== 200) {
        return callback(body)
      }
      if (!body) return callback('No response from colu server.')
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
