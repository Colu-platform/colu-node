var assert = require('assert')
var bitcoin = require('bitcoinjs-lib')

module.exports = User

function User (userId) {
  assert(userId && ['xpub', 'xpri', 'tpub', 'tpri'].indexOf(userId.substr(0, 4)) > -1, 'Not a valid userId.')
  this.root = new bitcoin.HDNode.fromBase58(userId)
}

User.prototype.getId = function () {
  return this.root.toBase58()
}

User.prototype.getPublicKey = function (index) {
  index = index || 0
  var addressNode = this.root.derive(0).derive(index)
  return addressNode.pubKey.toHex()
}

User.prototype.getAddress = function (index) {
  index = index || 0
  var addressNode = this.root.derive(0).derive(index)
  return addressNode.getAddress().toString()
}

User.prototype.getRootPublicKey = function () {
  return this.root.pubKey.toHex()
}

User.prototype.getChainCode = function () {
  return this.root.chainCode.toString('hex')
}
