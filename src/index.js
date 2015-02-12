var bitcoin = require('bitcoinjs-lib')
var crypto = require('crypto')
var request = require('request')
var qr = require('qr-encode')
var bigi = require('bigi')
var User = require('./user.js')

var coluHost = 'https://secure.colu.co'

module.exports = Colu

function Colu(companyName, network, privateKey, cc, i) {
  this.companyName = companyName
  
  if (!privateKey) {
    this.privateKey = bitcoin.ECKey.makeRandom(true)
  }
  else {
    this.privateKey = bitcoin.ECKey.fromWIF(privateKey)
  }

  this.cc = cc || generateCc()
  this.i = i || generateI()
  
  if (network && network.toLowerCase() === 'testnet') {
    this.network = bitcoin.networks.testnet
  }  else {
    this.network = bitcoin.networks.bitcoin
  }
}

Colu.prototype.register = function(callback) {
  var companyPubKey = this.privateKey.pub.toHex()
  request.post(coluHost + "/register_company_public_key",
    {form: {company_public_key: companyPubKey} },
    function (err, response, body) {
      if (err) {
          return callback(err)
      }
      var txDetails = createOpReturnTx(JSON.parse(body), this.privateKey, this.cc, this.i)
      request.post(coluHost + "/finalize_company_registration",
        {form: {tx_hex: txDetails.txHex, last_txid: txDetails.lastTxid} },
        function (err, response, body) {
          if (err) {
              return callback(err)
          }
          body = JSON.parse(body)
          return callback(null, body)
        }
      )
    }.bind(this)
  )
}

Colu.prototype.getWIF = function() {
  
  return this.privateKey.toWIF(this.network)
}

Colu.prototype.createRegistrationMessage = function(username) {
  var rand = crypto.randomBytes(10)
  var rand = rand.toString('hex')
  var utcTS = Date.now()
  var message = username + ',' + utcTS + ',' + rand
  var signature = ecdsaSign(message, this.privateKey)
  var jsonSignature = JSON.stringify(signature)
  var publicKey = this.privateKey.pub.toHex()
  var registrationMessage = { 
    message : message, 
    company_pub_key : publicKey, 
    company_public_key : publicKey,
    signature : jsonSignature,
    company_name: this.companyName
  }
  return registrationMessage
}

Colu.prototype.createRegistrationQR = function(registrationMessage) {
  var dataURI = qr(JSON.stringify(registrationMessage), {type: 15, size: 10, level: 'L'})
  return dataURI
}

Colu.prototype.registerUser = function(registrationMessage, callback) {
  request.post(coluHost + "/start_user_registration_to_company",
    {form: registrationMessage },
    function (err, response, body) {
      if (err) {
          return callback(err)
      }
      body = JSON.parse(body)
      if (this.verifyMessage(registrationMessage, body.verified_client_signature, body.client_public_key)) {
        var user = this.parseRegistrationBody(body)
        return callback(null, user.getId())
      }
      else {
        callback('signature not verified')
      }
    }.bind(this)
  )
}

Colu.prototype.parseRegistrationBody = function(body) {
  return new User(body.client_public_key, body.client_cc, this.network)
}

Colu.prototype.verifyUser = function(username, userId, addressIndex, callback) {
  addressIndex = addressIndex || 0
  var data_params = this.createRegistrationMessage(username)
  var user = User.fromId(userId, this.network)
  data_params.client_address = user.getAddress(addressIndex)
  data_params.token_details = 'token'
  request.post(coluHost + "/check_token_address",
    {form: data_params },
    function (err, response, body) {
      if (err) {
          return callback(err)
      }
      body = JSON.parse(body)
      if (this.verifyMessage(data_params, body.verified_client_signature, body.client_public_key)) {
        return callback(null, body)
      }
      else {
        callback('signature not verified')
      }
    }.bind(this)
  )
}

Colu.prototype.verifyMessage = function(registrationMessage, clientSignature, clientPublicKey) {
  var message = registrationMessage.message
  var signature = registrationMessage.signature
  var clientAddress = registrationMessage.client_address
  var clientMessage = message+';'+signature
  var hash = crypto.createHash('sha256').update(clientMessage).digest()
  console.log(clientPublicKey);
  var publicKey = bitcoin.ECPubKey.fromHex(clientPublicKey)
  if (clientAddress) {
    return (publicKey.getAddress(this.network) == clientAddress) && ecdsa_verify(hash, clientSignature, publicKey)
  }
  return ecdsa_verify(hash, clientSignature, publicKey)
}

function generateCc() {
  var rng = crypto.randomBytes
  var buffer = rng(32)
  return buffer.toString('hex')
}

function generateI() {
  var rng = crypto.randomBytes
  var buffer = rng(8)
  buffer[0] = buffer[0] & 0x7f
  buffer[4] = buffer[4] & 0x7f
  return buffer.toString('hex')
}

function createOpReturnTx(txDetails, priv, cc, i) {
  var tx = new bitcoin.TransactionBuilder()
  tx.addInput(txDetails.txid, 0)
  tx.addOutput(txDetails.return_address, txDetails.dust)
  var bcc = new Buffer(cc, 'hex')
  var bi = new Buffer(i, 'hex')
  var buf = Buffer.concat([bcc, bi])
  tx.addOutput(bitcoin.Script.fromChunks([bitcoin.opcodes.OP_RETURN, buf]), 0)
  tx.sign(0, priv)
  cookedTx = tx.build()
  ans = { txHex: cookedTx.toHex(), lastTxid: txDetails.txid}
  return ans
}

function ecdsaSign(message, privateKey) {
  var shaMsg = crypto.createHash('sha256').update(message).digest()
  var signature = privateKey.sign(shaMsg)
  var signatureHex = {}
  signatureHex.s = signature.s.toString(16)
  signatureHex.r = signature.r.toString(16)
  if (signatureHex.s.length % 2 != 0) signatureHex.s = '0' + signatureHex.s
  if (signatureHex.r.length % 2 != 0) signatureHex.r = '0' + signatureHex.r
  return signatureHex
}

function ecdsa_verify(hash, signature, publicKey) {

  var json_signature = JSON.parse(signature)
  var sig_obj = {}
  sig_obj.s = bigi.fromHex(json_signature.s)
  sig_obj.r = bigi.fromHex(json_signature.r)
  return isValid = publicKey.verify(hash, sig_obj)
}

