var Colu = require(__dirname + '/../src/index.js')
var User = require(__dirname + '/../src/user.js')
var assert = require('assert')
var privateSeed = 'c507290be50bc29a787af1901ff80e1c9f17e4020ee0a4fd51495ee4424d6150'
var colu_instance

describe('Colu SDK', function () {
  this.timeout(0)
  it('should 1', function (done) {
    Colu.init('my_company', 'testnet', function (err, colu) {
      if (err) {
        return console.log('err: ' + err)
      }
      assert(colu, 'Initialized colu instance')
      done()
      // This is your private seed, keep it safe!!!
      // console.log('Private seed: ' + colu.getPrivateSeed())
    })
  })

  it('should 2', function (done) {
    Colu.init('my_company', 'testnet', privateSeed, function (err, colu) {
      if (err) {
        return console.log('err: ' + err)
      }
      colu_instance = colu
      // This is your private seed, keep it safe!!!
      console.log('seed: ' + colu.getPrivateSeed())
      // var nextAccount = 1 // colu.nextAccount
      console.log('nextAccount: ' + colu.nextAccount)
      done()
      // colu.ccIssueFinanced('bob_' + nextAccount, nextAccount, 1, function (err, data) {
      //   if (err) {
      //     console.error('error: ' + err)
      //   } else {
      //     console.log('data: ' + JSON.stringify(data))
      //   }
      //   done()
      // })
    })
  })

  it('should 3', function (done) {
    var username = 'bobicbob52'

    var phonenumber = '+1234567890123'
    var registrationMessage = colu_instance.createRegistrationMessage(username)

    colu_instance.registerUserByPhonenumber(registrationMessage, phonenumber, function (err, data) {
      if (err) {
        console.log('Error1: ' + JSON.stringify(err))
        done()
      }
      console.log('userId: ' + data.userId)
  //      console.log('assetId: '+data.assetId)
      // var username = colu_instance.getUsername(registrationMessage)
      var accountIndex = colu_instance.hdwallet[registrationMessage.company_public_key].accountIndex
      var user = new User(data.userId)
      return colu_instance.issueAndSend(accountIndex, user, function (err, assetId) {
        if (err) {
          console.log('Error2: ' + JSON.stringify(err))
          return done()
        }
        console.log('assetId: ' + assetId)
        done()
      })
    })
  })

  it('should 4', function (done) {
    var username = 'bobicbob30'
    var registrationMessage = colu_instance.createRegistrationMessage(username)

    // You can create your own complicated qr code, or you can generate a simplified code and get it back from us in a callback.
    // var qr = colu.createRegistrationQR(registrationMessage)

    colu_instance.getRegistrationQR(registrationMessage, function (err, code, qr) {
      if (err) {
        console.error('error: ' + err)
        return done()
      }
      console.log(registrationMessage, qr)
      done()
    })
  })

  it('should 5', function (done) {
    var nextAccount = 113 // colu.nextAccount
    console.log('nextAccount: ' + colu_instance.nextAccount)
    colu_instance.ccSendFinanced(nextAccount, 'mxwSkkj7M6RVU1TTAneqvmVDgQ81U4B5r1', 'UYCLgKh87n2PZUcndwig5HJkBHPsSSWgzT', 1, function (err, data) {
      if (err) {
        console.error('error: ' + err)
      } else {
        console.log('data: ' + JSON.stringify(data))
      }
      done()
    })
  })

  it('should 6', function (done) {
    var username = 'bobicbob41'
    var assetId = 'oH8ufSixYep1wrBFcSbQeKipyXYdGxPGYh'

    colu_instance.verifyUser(username, assetId, function (err, data) {
      if (err) {
        console.error('error: ' + err)
      } else {
        console.log('data: ' + JSON.stringify(data))
      }
      done()
    })
  })
})
