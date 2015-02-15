var assert = require('assert')
var bitcoin = require('bitcoinjs-lib')

module.exports = User

function User(extended_public_key) {
  this.root = new bitcoin.HDNode.fromBase58(extended_public_key)
}

User.prototype.getId = function() {
  return this.root.toBase58()
}

User.prototype.getAddress = function(index) {
  var addressNode = this.root.derive(0).derive(index)
  return addressNode.getAddress().toString()
}

User.prototype.getPublicKey = function(index) {
  return this.root.pubKey.toBuffer().toString('hex')
}
