//var Colu = require('colu-node')
var Colu = require('../src/index.js')
var colu = new Colu('my_company', 'testnet')

// This is your private key, keep it safe!!!
console.log('WIF: '+colu.getWIF())