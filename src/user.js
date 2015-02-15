var assert = require('assert')
var bitcoin = require('bitcoinjs-lib')

module.exports = User

function User(userId) {
  assert(userId && ['xpub', 'xpri', 'tpub', 'tpri'].indexOf(userId.substr(0, 4)) > -1, 'Not a valid userId.')
  this.root = new bitcoin.HDNode.fromBase58(userId)
}

User.prototype.getId = function() {
  return this.root.toBase58()
}

User.prototype.getAddress = function(index) {
  index = index || 0
  var addressNode = this.root.derive(0).derive(index)
  return addressNode.getAddress().toString()
}

User.prototype.getPublicKey = function() {
  return this.root.pubKey.toBuffer().toString('hex')
}

User.prototype.getChainCode = function() {
  return this.root.chainCode.toString('hex')
}