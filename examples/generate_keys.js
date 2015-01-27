//var Colu = require('colu-node')
var Colu = require('../src/index.js')
var colu = new Colu('my_company')

// This is your private key, keep it safe!!!
console.log('WIF: '+colu.getWIF('testnet'))

// Those are your cc and i, they are public and should be registered on the blockchain using the register method.
console.log('cc: '+colu.cc) 
console.log('i: '+colu.i)