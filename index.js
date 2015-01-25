var bitcoin = require('bitcoinjs-lib');
var crypto = require('crypto');
var request = require('request');

var coluHost = 'https://secure.colu.co';

module.exports = Colu;

function Colu(companyName, privateKey, cc, i) {
  this.companyName = companyName;
  
  if (!privateKey) {
    this.privateKey = bitcoin.ECKey.makeRandom(true);
  }
  else {
    this.privateKey = bitcoin.ECKey.fromWIF(privateKey)
  }

  this.cc = cc || generateCc();
  this.i = i || generateI();
}

Colu.prototype.register = function(callback) {
  var companyPubKey = this.privateKey.pub.toHex();
  request.post(coluHost + "/register_company_public_key",
    {form: {company_public_key: companyPubKey} },
    function (err, response, body) {
      if (err) {
          return callback(err);
      }
      var txDetails = createOpReturnTx(JSON.parse(body), this.privateKey, this.cc, this.i);
      request.post(coluHost + "/finalize_company_registration",
        {form: {tx_hex: txDetails.txHex, last_txid: txDetails.lastTxid} },
        function (err, response, body) {
          if (err) {
              return callback(err);
          }
          return callback(null, body);
        }
      );
    }.bind(this)
  );
}

Colu.prototype.createRegistrationMessage = function(username) {
  
}

Colu.prototype.createRegistrationQR = function(registrationMessage) {
  
}

Colu.prototype.registerUser = function(registrationMessage, callback) {
  
}

Colu.prototype.verifyUser = function(username, callback) {
  
}

function generateCc() {
  var rng = crypto.randomBytes;
  var buffer = rng(32);
  return buffer.toString('hex');
}

function generateI() {
  var rng = crypto.randomBytes;
  var buffer = rng(8);
  buffer[0] = buffer[0] & 0x7f;
  buffer[4] = buffer[4] & 0x7f;
  return buffer.toString('hex');
}

function createOpReturnTx(txDetails, priv, cc, i) {
  var tx = new bitcoin.TransactionBuilder();
  tx.addInput(txDetails.txid, 0);
  tx.addOutput(txDetails.return_address, txDetails.dust);
  var bcc = new Buffer(cc, 'hex');
  var bi = new Buffer(i, 'hex');
  var buf = concatBuffers(bcc, bi);
  tx.addOutput(bitcoin.Script.fromChunks([bitcoin.opcodes.OP_RETURN, buf]), 0);
  tx.sign(0, priv);
  cookedTx = tx.build();
  ans = { txHex: cookedTx.toHex(), lastTxid: txDetails.txid};
  return ans;
}

function concatBuffers(buf1, buf2) {
  var buf = new Buffer(buf1.length + buf2.length);
  buf1.copy(buf);
  buf2.copy(buf, buf1.length);
  return buf;
}