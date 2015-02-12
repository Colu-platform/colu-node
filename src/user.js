var assert = require('assert')
var bitcoin = require('bitcoinjs-lib')

module.exports = User

function User(public_key, cc, network) {
  this.public_key = public_key
  this.cc = cc
  this.root = new bitcoin.HDNode(bitcoin.ECPubKey.fromHex(public_key).Q, new Buffer(cc, 'hex'), network)
}

User.prototype.getId = function() {
  return (this.public_key+this.cc).toLowerCase();
}

User.fromId = function(id, network) {
  assert.equal(id.length, 130, 'Expected id length of 130, got ' + id.length)
  var public_key = id.slice(0, 66)
  var cc = id.slice(66, 130)
  return new User(public_key, cc, network)
}

User.prototype.getAddress = function(index) {
  addressNode = this.root.derive(0).derive(index)
  return addressNode.getAddress().toString();
}
