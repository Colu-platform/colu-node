var Colu = require('./index.js');
var colu = new Colu('teset_company');

colu.register(function (err, res) {
   if (err) {
     console.log('err '+err);
   }
   else {
     console.log('res '+res);
   }
});