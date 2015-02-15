var bitcoin = require('bitcoinjs-lib')
var crypto = require('crypto')
var request = require('request')
var qr = require('qr-encode')
var bigi = require('bigi')
var User = require('./user.js')

var coluHost = 'https://secure.colu.co'

module.exports = Colu

function Colu(companyName, network, privateKey) {
  this.companyName = companyName
  
  if (!privateKey) {
    this.privateKey = bitcoin.ECKey.makeRandom(true)
  }
  else {
    this.privateKey = bitcoin.ECKey.fromWIF(privateKey)
  }
  
  if (network && network.toLowerCase() === 'testnet') {
    this.network = bitcoin.networks.testnet
  }  else {
    this.network = bitcoin.networks.bitcoin
  }
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
      var user = this.parseRegistrationBody(body)
      if (user) {
        var client_public_key = user.getPublicKey()
        if (this.verifyMessage(registrationMessage, body.verified_client_signature, client_public_key)) {
        
          return callback(null, user.getId())
        }
        else {
          callback('Signature not verified.')
        }
      }
      else {
        callback('Wrong answer from server.')
      }
    }.bind(this)
  )
}

Colu.prototype.parseRegistrationBody = function(body) {
  if (body && 'extended_public_key' in body) {
    return new User(body.extended_public_key)
  }
  return null
}

Colu.prototype.verifyUser = function(username, userId, addressIndex, callback) {
  addressIndex = addressIndex || 0
  var data_params = this.createRegistrationMessage(username)
  var user = new User(userId)
  data_params.client_address = user.getAddress(addressIndex)
  console.log('address: '+data_params.client_address)
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
  var publicKey = bitcoin.ECPubKey.fromHex(clientPublicKey)
  if (clientAddress) {
    return (publicKey.getAddress(this.network) == clientAddress) && ecdsa_verify(hash, clientSignature, publicKey)
  }
  return ecdsa_verify(hash, clientSignature, publicKey)
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
