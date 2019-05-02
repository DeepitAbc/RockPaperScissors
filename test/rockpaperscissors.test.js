"use strict"; 

web3.eth.expectedExceptionPromise   = require("../utils/expectedExceptionPromise.js");
web3.eth.getEventsPromise           = require("../utils/getEventsPromise.js");
web3.eth.getFirstAccountPromise     = require("../utils/getFirstAccountPromise.js");
web3.eth.promisifyWeb3              = require("../utils/promisifyWeb3.js");
web3.eth.sequentialPromise          = require("../utils/sequentialPromise.js");
web3.eth.getTransactionReceiptMined = require('../utils/getTransactionReceiptMined.js');
web3.eth.advanceBlock = require('../utils/advanceBlock.js');

const { BN, sha3, toWei, fromAscii } = web3.utils;

require('chai')
    .use(require('chai-as-promised'))
    .use(require('bn-chai')(BN))
    .should();

const MAX_BLOCK = 20;
const DELTA_BLOCK = 10;

const USER_HASH = sha3("User-Secret");
const EXCHANGE_HASH = sha3("exchange-Secret");


// Import the smart contracts
const RockPaperScissors       = artifacts.require('RockPaperScissors.sol');

contract('RockPaperScissors', function(accounts) {
    const MAX_GAS = 4700000;


    let owner, user1, user2, exchange;
    before("checking accounts", async function() {
        assert.isAtLeast(accounts.length, 4, "not enough accounts");
        [owner, user1, user2, exchange] = accounts;
    }); 

    describe('#RockPaperScissors()', async function() {
       describe("#constructor()", async function() {
          it("verify if contract is deployed", async function() {
              let instance = await RockPaperScissors.new({ from: owner , gas: MAX_GAS})

              const receipt = await web3.eth.getTransactionReceiptMined(instance.transactionHash);
              receipt.logs.length.should.be.equal(1);
              let logEventCreated = receipt.logs[0];
              logEventCreated.topics[0].should.be.equal(sha3('PauserAdded(address)'));
           });
       });

       async function jumpDeltaBlock(deltaBlock) {
          let i;
          for (i = 0; i < deltaBlock; i++)  {
             await web3.eth.advanceBlock();
          }
       }

       describe('Test methods', async function() {
            let instance;

            beforeEach("should deploy RockPaperScissors instance",  async function() {
                instance = await RockPaperScissors.new({ from: owner , gas: MAX_GAS})
            });

            describe("#pause()", async function() {
                it("is OK if called by owner", async function() {
                    await instance.pause({ from: owner, gas: MAX_GAS})
                   .should.be.fulfilled;
                });

                it("should fail if called by any user", async function() {
                    await web3.eth.expectedExceptionPromise(() => {
                        return instance.pause({ from: user1, gas: MAX_GAS });
                     }, MAX_GAS);
                });

                it("should fail if already paused", async function() {
                    await instance.pause({ from: owner, gas: MAX_GAS})
                    .should.be.fulfilled;

                    await web3.eth.expectedExceptionPromise(
                      () => {return instance.pause({ from: owner, gas: MAX_GAS }); }, 
                      MAX_GAS);
                });

                it("emit event", async function() {
                    let result = await instance.pause({ from: owner, gas: MAX_GAS})
                    .should.be.fulfilled;
                    assert.strictEqual(result.logs.length, 1);
                    let logEvent = result.logs[0];

                    assert.strictEqual(logEvent.event, "Paused", "Paused name is wrong");
                    assert.strictEqual(logEvent.args.account, owner, "caller is wrong");
                });
            });

            describe("#unpause()", async function() {
                it("is OK if called by owner", async function() {
                    await instance.pause({ from: owner, gas: MAX_GAS})
                    .should.be.fulfilled;
                    await instance.unpause({ from: owner, gas: MAX_GAS})
                    .should.be.fulfilled;
                });

                it("should fail if called by any user", async function() {
                    await web3.eth.expectedExceptionPromise(
                      () => { return instance.unpause({ from: user1, gas: MAX_GAS }); }, 
                      MAX_GAS);
                });

                it("should fail if !paused ", async function() {
                    await web3.eth.expectedExceptionPromise(
                      () => { return instance.unpause({ from: owner, gas: MAX_GAS }); },
                      MAX_GAS);
                });

                it("emit event", async function() {
                    await instance.pause({ from: owner, gas: MAX_GAS})
                    .should.be.fulfilled;
                    let result = await instance.unpause({ from: owner, gas: MAX_GAS})
                    .should.be.fulfilled;
                    assert.strictEqual(result.logs.length, 1);
                    let logEvent = result.logs[0];

                    assert.strictEqual(logEvent.event, "Unpaused", "Unpaused name is wrong");
                    assert.strictEqual(logEvent.args.account, owner, "caller is wrong");
                });
            });
       });
    });
});


