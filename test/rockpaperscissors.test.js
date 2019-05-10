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




// Import the smart contracts
const RockPaperScissors       = artifacts.require('RockPaperScissors.sol');

contract('RockPaperScissors', function(accounts) {
    const MAX_GAS = 4700000;
    const GAME_PRICE     = toWei('13', 'Gwei');
    const DELTA_BLKS   = 10;
    const PLAYER1_PWD = "pwd1";
    const PLAYER2_PWD = "pwd2";
    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

    // Game moves
    const VOID = 0;
    const ROCK = 1;
    const PAPER = 2;
    const SCISSORS = 3;

    let owner, user1, user2, user3;
    before("checking accounts", async function() {
        assert.isAtLeast(accounts.length, 4, "not enough accounts");
        [owner, user1, user2, user3] = accounts;
    }); 

    describe('#RockPaperScissors()', async function() {
       describe("#constructor()", async function() {
          it("verify if contract is deployed", async function() {
              let instance = await RockPaperScissors.new({ from: owner , gas: MAX_GAS})

              const receipt = await web3.eth.getTransactionReceiptMined(instance.transactionHash);
              receipt.logs.length.should.be.equal(2);
              let logEventCreated = receipt.logs[0];
              logEventCreated.topics[0].should.be.equal(sha3('PauserAdded(address)'));
              logEventCreated = receipt.logs[1];
              logEventCreated.topics[0].should.be.equal(sha3('LogGameCreated(address)'));
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

            describe("#newGame()", async function() {
                it("is OK if called by owner", async function() {
                    const gameHash = await instance.gameHash(user1, user2, { from: user1, gas: MAX_GAS})
                    .should.be.fulfilled;
                    const move1Hash = await instance.moveHash(user1, PAPER, fromAscii(PLAYER1_PWD), { from: user1, gas: MAX_GAS})
                    const result = await instance.newGame(gameHash, move1Hash, DELTA_BLKS, GAME_PRICE, { from: user1, gas: MAX_GAS, value: GAME_PRICE})
                    .should.be.fulfilled;
                });

                it("is OK if called by any user user3", async function() {
                    const gameHash = await instance.gameHash(user1, user2, { from: user1, gas: MAX_GAS})
                    .should.be.fulfilled;
                    const move1Hash = await instance.moveHash(user1, PAPER, fromAscii(PLAYER1_PWD), { from: user1, gas: MAX_GAS})
                    const result = await instance.newGame(gameHash, move1Hash, DELTA_BLKS, GAME_PRICE, { from: user1, gas: MAX_GAS, value: GAME_PRICE})
                    .should.be.fulfilled;
                });

                it("fail if gamehash is 0", async function() {
                    const move1Hash = await instance.moveHash(user1, PAPER, fromAscii(PLAYER1_PWD), { from: user1, gas: MAX_GAS})
                    await web3.eth.expectedExceptionPromise(
                      () => { return instance.newGame(fromAscii(''), move1Hash, DELTA_BLKS, GAME_PRICE, { from: user1, gas: MAX_GAS, value: GAME_PRICE}); }, 
                      MAX_GAS);
                });

                it("fail if DELTA_BLOCKS is 0", async function() {
                    const move1Hash = await instance.moveHash(user1, PAPER, fromAscii(PLAYER1_PWD), { from: user1, gas: MAX_GAS})
                    const gameHash = await instance.gameHash(user1, user2, { from: user1, gas: MAX_GAS})
                    await web3.eth.expectedExceptionPromise(
                      () => { return instance.newGame(gameHash, move1Hash, 0, GAME_PRICE, { from: user1, gas: MAX_GAS, value: GAME_PRICE}); }, 
                      MAX_GAS);
                });

                it("fail if reuse the same moveHASH", async function() {
                    let move1Hash = await instance.moveHash(user1, PAPER, fromAscii(PLAYER1_PWD), { from: user1, gas: MAX_GAS})
                    let gameHash = await instance.gameHash(user1, user2, { from: user1, gas: MAX_GAS})
                    instance.newGame(gameHash, move1Hash, DELTA_BLKS, GAME_PRICE, { from: user1, gas: MAX_GAS, value: GAME_PRICE});

                    move1Hash = await instance.moveHash(user1, PAPER, fromAscii(PLAYER1_PWD), { from: user1, gas: MAX_GAS})
                    gameHash = await instance.gameHash(user1, user2, { from: user1, gas: MAX_GAS})
                    await web3.eth.expectedExceptionPromise(
                      () => { return instance.newGame(gameHash, move1Hash, DELTA_BLKS, GAME_PRICE, { from: user1, gas: MAX_GAS, value: GAME_PRICE}); }, 
                      MAX_GAS);
                });

                it("is OK if users play more games", async function() {
                    const gameHash = await instance.gameHash(user1, user2, { from: user1, gas: MAX_GAS})
                    .should.be.fulfilled;
                    let move1Hash = await instance.moveHash(user1, PAPER, fromAscii(PLAYER1_PWD), { from: user1, gas: MAX_GAS})
                    let result = await instance.newGame(gameHash, move1Hash, DELTA_BLKS, GAME_PRICE, { from: user1, gas: MAX_GAS, value: GAME_PRICE})
                    .should.be.fulfilled;
                    const gameHash1 = await instance.gameHash(user1, user2, { from: user1, gas: MAX_GAS})
                    .should.be.fulfilled;
                    move1Hash = await instance.moveHash(user1, PAPER, fromAscii('secret2'), { from: user1, gas: MAX_GAS})
                    result = await instance.newGame(gameHash1, move1Hash, DELTA_BLKS, GAME_PRICE, { from: user1, gas: MAX_GAS, value: GAME_PRICE})
                    .should.be.fulfilled;
                });

                it("emit event", async function() {
                    const gameHash = await instance.gameHash(user1, user2, { from: user1, gas: MAX_GAS})
                    .should.be.fulfilled;
                    const move1Hash = await instance.moveHash(user1, PAPER, fromAscii(PLAYER1_PWD), { from: user1, gas: MAX_GAS})
                    const result = await instance.newGame(gameHash, move1Hash, DELTA_BLKS, GAME_PRICE, { from: user1, gas: MAX_GAS, value: GAME_PRICE})
                    .should.be.fulfilled;
                    assert.strictEqual(result.logs.length, 1);
                    let logEvent = result.logs[0];

                    let expBlock = await web3.eth.getBlockNumber();
                    let expBlockBN = new BN(expBlock);
                    let deltaBlockBN = new BN(DELTA_BLKS);
                    expBlockBN = expBlockBN.add(deltaBlockBN);

                    assert.strictEqual(logEvent.event, "LogNewGame", "LogNewGame event is wrong");
                    assert.strictEqual(logEvent.args.player1, user1, "player1 is wrong");
                    assert.strictEqual(logEvent.args.gameHash, gameHash, "gameHash is wrong");
                    assert.strictEqual(logEvent.args.moveHash, move1Hash, "moveHash is wrong");
                    assert.strictEqual(logEvent.args.betAmount.toString(), GAME_PRICE, "betAmount is wrong");
                    assert.strictEqual(logEvent.args.expiryBlock.toString(), expBlockBN.toString(), "expiryBlock is wrong");
                });
            });


            describe("#joinGame()", async function() {
                let gameHash;
                beforeEach("should deploy RockPaperScissors instance",  async function() {
                    instance = await RockPaperScissors.new({ from: owner , gas: MAX_GAS})
                    gameHash = await instance.gameHash(user1, user2, { from: user1, gas: MAX_GAS})
                    const move1Hash = await instance.moveHash(user1, PAPER, fromAscii(PLAYER1_PWD), { from: user1, gas: MAX_GAS})
                    await instance.newGame(gameHash, move1Hash, DELTA_BLKS, GAME_PRICE, { from: user1, gas: MAX_GAS, value: GAME_PRICE})
                });

                it("ok if uses correct params", async function() {
                    const moveHash = await instance.moveHash(user2, PAPER, fromAscii(PLAYER2_PWD), { from: user2, gas: MAX_GAS})
                    await instance.joinGame(gameHash, moveHash, { from: user2, gas: MAX_GAS, value: GAME_PRICE})
                    .should.be.fulfilled;
                });

                it("fail if play after timeout", async function() {
                    const moveHash = await instance.moveHash(user2, PAPER, fromAscii(PLAYER2_PWD), { from: user2, gas: MAX_GAS})
                    await jumpDeltaBlock(DELTA_BLKS+1);
                    await web3.eth.expectedExceptionPromise(
                      () => { return instance.joinGame(gameHash, moveHash, { from: user2, gas: MAX_GAS, value: GAME_PRICE}); }, 
                      MAX_GAS);
                });

                it("fail if zero hash", async function() {
                    const moveHash = await instance.moveHash(user2, PAPER, fromAscii(PLAYER2_PWD), { from: user2, gas: MAX_GAS})
                    await web3.eth.expectedExceptionPromise(
                      () => { return instance.joinGame(fromAscii(''), moveHash, { from: user2, gas: MAX_GAS, value: GAME_PRICE}); }, 
                      MAX_GAS);
                });

                it("fail if wrong hash", async function() {
                    const localGameHash = await instance.gameHash(user2, user2, { from: user2, gas: MAX_GAS})
                    const moveHash = await instance.moveHash(user2, PAPER, fromAscii(PLAYER2_PWD), { from: user2, gas: MAX_GAS})
                    await web3.eth.expectedExceptionPromise(
                      () => { return instance.joinGame(localGameHash, moveHash, { from: user2, gas: MAX_GAS, value: GAME_PRICE}); }, 
                      MAX_GAS);
                });

                it("fail if no provide ether", async function() {
                    const moveHash = await instance.moveHash(user2, PAPER, fromAscii(PLAYER2_PWD), { from: user2, gas: MAX_GAS})
                    await web3.eth.expectedExceptionPromise(
                      () => { return instance.joinGame(gameHash, moveHash, { from: user2, gas: MAX_GAS}); }, 
                      MAX_GAS);
                });

                it("fail if player play two times", async function() {
                    const moveHash = await instance.moveHash(user2, PAPER, fromAscii(PLAYER2_PWD), { from: user2, gas: MAX_GAS})
                    await instance.joinGame(gameHash, moveHash, { from: user2, gas: MAX_GAS, value: GAME_PRICE});
                    await web3.eth.expectedExceptionPromise(
                      () => { return instance.joinGame(gameHash, moveHash, { from: user2, gas: MAX_GAS, value: GAME_PRICE}); }, 
                      MAX_GAS);
                });

                it("emitted event", async function() {
                    const moveHash = await instance.moveHash(user2, PAPER, fromAscii(PLAYER2_PWD), { from: user2, gas: MAX_GAS})
                    const result = await instance.joinGame(gameHash, moveHash, { from: user2, gas: MAX_GAS, value: GAME_PRICE})

                    assert.strictEqual(result.logs.length, 1);
                    let logEvent = result.logs[0];

                    assert.strictEqual(logEvent.event, "LogGameJoined", "GamePlayed event is wrong");
                    assert.strictEqual(logEvent.args.player, user2, "player is wrong");
                    assert.strictEqual(logEvent.args.gameHash, gameHash, "hash is wrong");
                    assert.strictEqual(logEvent.args.moveHash, moveHash, "moveHash is wrong");
                });
            });


            describe("#revealGame()", async function() {
                let gameHash;
                beforeEach("should deploy RockPaperScissors instance",  async function() {
                    instance = await RockPaperScissors.new({ from: owner , gas: MAX_GAS})
                    gameHash = await instance.gameHash(user1, user2, { from: user1, gas: MAX_GAS})
                    const move1Hash = await instance.moveHash(user1, PAPER, fromAscii(PLAYER1_PWD), { from: user1, gas: MAX_GAS})
                    await instance.newGame(gameHash, move1Hash, DELTA_BLKS, GAME_PRICE, { from: user1, gas: MAX_GAS, value: GAME_PRICE})

                    const move2Hash = await instance.moveHash(user2, PAPER, fromAscii(PLAYER2_PWD), { from: user2, gas: MAX_GAS})
                    await instance.joinGame(gameHash, move2Hash, { from: user2, gas: MAX_GAS, value: GAME_PRICE});
                });

                it("is OK if reveal first move", async function() {
                      await instance.revealGame(gameHash, PAPER, fromAscii(PLAYER1_PWD), { from: user1, gas: MAX_GAS}); 
                });

                it("fail after timeout", async function() {
                    await jumpDeltaBlock(DELTA_BLKS+1);
                    await web3.eth.expectedExceptionPromise(
                      () => { return instance.revealGame(gameHash, PAPER, fromAscii(PLAYER1_PWD), { from: user1, gas: MAX_GAS}); }, 
                      MAX_GAS);
                });

                it("fail with hash zero", async function() {
                    await web3.eth.expectedExceptionPromise(
                      () => { return instance.revealGame(fromAscii(''), PAPER, fromAscii(PLAYER1_PWD), { from: user1, gas: MAX_GAS}); }, 
                      MAX_GAS);
                });

                it("fail with wrong move", async function() {
                    await web3.eth.expectedExceptionPromise(
                      () => { return instance.revealGame(gameHash, 7, fromAscii(PLAYER1_PWD), { from: user1, gas: MAX_GAS}); }, 
                      MAX_GAS);
                });

                it("fail if player1 reveal two times", async function() {
                    await instance.revealGame(gameHash, PAPER, fromAscii(PLAYER1_PWD), { from: user1, gas: MAX_GAS}); 
                    await web3.eth.expectedExceptionPromise(
                      () => { return instance.revealGame(gameHash, PAPER, fromAscii(PLAYER1_PWD), { from: user1, gas: MAX_GAS}); }, 
                      MAX_GAS);
                });

                it("fail if player2 reveal two times", async function() {
                    await instance.revealGame(gameHash, PAPER, fromAscii(PLAYER2_PWD), { from: user2, gas: MAX_GAS}); 
                    await web3.eth.expectedExceptionPromise(
                      () => { return instance.revealGame(gameHash, PAPER, fromAscii(PLAYER2_PWD), { from: user2, gas: MAX_GAS}); }, 
                      MAX_GAS);
                });

                it("fail if reveal another user", async function() {
                    await web3.eth.expectedExceptionPromise(
                      () => { return instance.revealGame(gameHash, PAPER, fromAscii(PLAYER2_PWD), { from: user3, gas: MAX_GAS}); }, 
                      MAX_GAS);
                });

                it("fail if user change move", async function() {
                    await web3.eth.expectedExceptionPromise(
                      () => { return instance.revealGame(gameHash, ROCK, fromAscii(PLAYER1_PWD), { from: user1, gas: MAX_GAS}); }, 
                      MAX_GAS);
                });

                it("fail if user change password", async function() {
                    await web3.eth.expectedExceptionPromise(
                      () => { return instance.revealGame(gameHash, PAPER, fromAscii('secret'), { from: user1, gas: MAX_GAS}); }, 
                      MAX_GAS);
                });

                it("fail if both user have not yet played", async function() {
                    let instance1 = await RockPaperScissors.new({ from: owner , gas: MAX_GAS})
                    gameHash = await instance1.gameHash(user1, user2, { from: user1, gas: MAX_GAS})
                    const move1Hash = await instance1.moveHash(user1, PAPER, fromAscii(PLAYER1_PWD), { from: user1, gas: MAX_GAS})
                    await instance1.newGame(gameHash, move1Hash, DELTA_BLKS, GAME_PRICE, { from: user1, gas: MAX_GAS, value: GAME_PRICE})

                    await web3.eth.expectedExceptionPromise(
                      () => { return instance1.revealGame(gameHash, PAPER, fromAscii(PLAYER1_PWD), { from: user1, gas: MAX_GAS}); }, 
                      MAX_GAS);
                });

                it("if reveal only one user returns 0", async function() {
                    let result = await instance.revealGame(gameHash, PAPER, fromAscii(PLAYER1_PWD), { from: user1, gas: MAX_GAS}); 
                    assert.strictEqual(result.logs.length, 1);
                    let logEvent = result.logs[0];

                    assert.strictEqual(logEvent.event, "LogGameRevealed", "GameRevealed event is wrong");
                    assert.strictEqual(logEvent.args.player, user1, "player is wrong");
                    assert.strictEqual(logEvent.args.gameHash, gameHash, "hash is wrong");
                    assert.strictEqual(logEvent.args.move.toNumber(), PAPER, "move is wrong");
                    assert.strictEqual(logEvent.args.winnerId.toNumber(), 0, "winnerId is wrong");
                });

                const validTestSet = [
                   { move1: 1, move2: 1, winner: 0 }, // Rock vs Rock = 0
                   { move1: 1, move2: 2, winner: 2 }, // Rock vs Paper = 2
                   { move1: 1, move2: 3, winner: 1 }, // Rock vs Scissors = 1
                   { move1: 2, move2: 1, winner: 1 }, // Paper vs Rock = 1
                   { move1: 2, move2: 2, winner: 0 }, // Paper vs Paper = 0
                   { move1: 2, move2: 3, winner: 2 }, // Paper vs Scissors = 2
                   { move1: 3, move2: 1, winner: 2 }, // Scissors vs Rock = 2
                   { move1: 3, move2: 2, winner: 1 }, // Scissors vs Paper = 1
                   { move1: 3, move2: 3, winner: 0 }, // Scissors vs Scissors = 0
               ]

                validTestSet.forEach(async function(validRecord) {
                    const move1 = validRecord.move1;
                    const move2 = validRecord.move2;
                    const winner = validRecord.winner;
                    it(`allowed play() player1: ${move1} player2: ${move2} win: ${winner}`, async function() {
                       let instance1 = await RockPaperScissors.new({ from: owner , gas: MAX_GAS})
                       gameHash = await instance1.gameHash(user1, user2, { from: user1, gas: MAX_GAS})
                       const move1Hash = await instance1.moveHash(user1, move1, fromAscii(PLAYER1_PWD), { from: user1, gas: MAX_GAS})
                       await instance1.newGame(gameHash, move1Hash, DELTA_BLKS, GAME_PRICE, { from: user1, gas: MAX_GAS, value: GAME_PRICE})

                       const oldB1 = await instance1.balances(user1);
                       const oldB2 = await instance1.balances(user2);
                       const oldB1BN = new BN(oldB1);
                       const oldB2BN = new BN(oldB2);

                       const move2Hash = await instance1.moveHash(user2, move2, fromAscii(PLAYER2_PWD), { from: user2, gas: MAX_GAS})
                       await instance1.joinGame(gameHash, move2Hash, { from: user2, gas: MAX_GAS, value: GAME_PRICE});
                       await instance1.revealGame(gameHash, move1, fromAscii(PLAYER1_PWD), { from: user1, gas: MAX_GAS});
                       let result = await instance1.revealGame(gameHash, move2, fromAscii(PLAYER2_PWD), { from: user2, gas: MAX_GAS});
                       assert.strictEqual(result.logs.length, 1);
                       let logEvent = result.logs[0];
                       assert.strictEqual(logEvent.args.winnerId.toNumber(), winner, "winnerId is wrong");

                       const newB1 = await instance1.balances(user1);
                       const newB2 = await instance1.balances(user2);
                       let newB1BN = new BN(newB1);
                       let newB2BN = new BN(newB2);
                       let priceBN = new BN(GAME_PRICE);
                       let expB1, expB2;


                       if (winner == 1)  {
                          expB1 = oldB1BN.add(priceBN).add(priceBN);
                          expB2 = oldB2BN;
                       }
                       else if (winner == 2)  {
                          expB1 = oldB1BN;
                          expB2 = oldB2BN.add(priceBN).add(priceBN);
                          
                       }
                       else {
                          expB1 = oldB1BN.add(priceBN);
                          expB2 = oldB2BN.add(priceBN);
                       }
                       assert.strictEqual(expB1.toString(), newB1BN.toString(), "balance player1 wrong" );
                       assert.strictEqual(expB2.toString(), newB2BN.toString(), "balance player2 wrong" );
                    });
                });
            });

            describe("#cancelGame()", async function() {
                it("player1 can cancel after timeout if player2 doesn't played",  async function() {
                   let instance1 = await RockPaperScissors.new({ from: owner , gas: MAX_GAS})
                   const gameHash = await instance1.gameHash(user1, user2, { from: user1, gas: MAX_GAS})
                   const move1Hash = await instance1.moveHash(user1, PAPER, fromAscii(PLAYER1_PWD), { from: user1, gas: MAX_GAS})
                   await instance1.newGame(gameHash, move1Hash, DELTA_BLKS, GAME_PRICE, { from: user1, gas: MAX_GAS, value: GAME_PRICE})
                   await jumpDeltaBlock(DELTA_BLKS+1);
                   await instance1.cancelGame(gameHash, { from: user1, gas: MAX_GAS})
                });

                it("fail if called before timeout",  async function() {
                   let instance1 = await RockPaperScissors.new({ from: owner , gas: MAX_GAS})
                   const gameHash = await instance1.gameHash(user1, user2, { from: user1, gas: MAX_GAS})
                   const move1Hash = await instance1.moveHash(user1, PAPER, fromAscii(PLAYER1_PWD), { from: user1, gas: MAX_GAS})
                   await instance1.newGame(gameHash, move1Hash, DELTA_BLKS, GAME_PRICE, { from: user1, gas: MAX_GAS, value: GAME_PRICE})
                   await web3.eth.expectedExceptionPromise(
                      () => { return instance1.cancelGame(gameHash,{ from: user1, gas: MAX_GAS}); },
                      MAX_GAS);
                });

                it("emitted event in case only player1 play",  async function() {
                   let instance1 = await RockPaperScissors.new({ from: owner , gas: MAX_GAS})
                   const gameHash = await instance1.gameHash(user1, user2, { from: user1, gas: MAX_GAS})
                   const move1Hash = await instance1.moveHash(user1, PAPER, fromAscii(PLAYER1_PWD), { from: user1, gas: MAX_GAS})
                   await instance1.newGame(gameHash, move1Hash, DELTA_BLKS, GAME_PRICE, { from: user1, gas: MAX_GAS, value: GAME_PRICE})
                   await jumpDeltaBlock(DELTA_BLKS+1);
                   let result = await instance1.cancelGame(gameHash, { from: user1, gas: MAX_GAS})
                   assert.strictEqual(result.logs.length, 1);
                   let logEvent = result.logs[0];

                   assert.strictEqual(logEvent.event, "LogGameCancelled", "LogGameCancelled event is wrong");
                   assert.strictEqual(logEvent.args.player, user1, "player1 is wrong");
                   assert.strictEqual(logEvent.args.gameHash, gameHash, "gameHash is wrong");
                   assert.strictEqual(logEvent.args.winnerId.toNumber(), 0, "winnerId is wrong"); 
                });

                it("emitted event in case only player1 reveal",  async function() {
                   let instance1 = await RockPaperScissors.new({ from: owner , gas: MAX_GAS})
                   const gameHash = await instance1.gameHash(user1, user2, { from: user1, gas: MAX_GAS})
                   const move1Hash = await instance1.moveHash(user1, PAPER, fromAscii(PLAYER1_PWD), { from: user1, gas: MAX_GAS})
                   await instance1.newGame(gameHash, move1Hash, DELTA_BLKS, GAME_PRICE, { from: user1, gas: MAX_GAS, value: GAME_PRICE})
                   const move2Hash = await instance1.moveHash(user2, PAPER, fromAscii(PLAYER2_PWD), { from: user2, gas: MAX_GAS})
                   await instance1.joinGame(gameHash, move2Hash, { from: user2, gas: MAX_GAS, value: GAME_PRICE});
                   await instance1.revealGame(gameHash, PAPER, fromAscii(PLAYER1_PWD), { from: user1, gas: MAX_GAS});
                   await jumpDeltaBlock(DELTA_BLKS+1);
                   let result = await instance1.cancelGame(gameHash, { from: user1, gas: MAX_GAS})
                   assert.strictEqual(result.logs.length, 1);
                   let logEvent = result.logs[0];

                   assert.strictEqual(logEvent.event, "LogGameCancelled", "LogGameCancelled event is wrong");
                   assert.strictEqual(logEvent.args.player, user1, "player1 is wrong");
                   assert.strictEqual(logEvent.args.gameHash, gameHash, "gameHash is wrong");
                   assert.strictEqual(logEvent.args.winnerId.toNumber(), 0, "winnerId is wrong"); 
                });

                it("emitted event in case only player2 reveal",  async function() {
                   let instance1 = await RockPaperScissors.new({ from: owner , gas: MAX_GAS})
                   const gameHash = await instance1.gameHash(user1, user2, { from: user1, gas: MAX_GAS})
                   const move1Hash = await instance1.moveHash(user1, PAPER, fromAscii(PLAYER1_PWD), { from: user1, gas: MAX_GAS})
                   await instance1.newGame(gameHash, move1Hash, DELTA_BLKS, GAME_PRICE, { from: user1, gas: MAX_GAS, value: GAME_PRICE})
                   const move2Hash = await instance1.moveHash(user2, PAPER, fromAscii(PLAYER2_PWD), { from: user2, gas: MAX_GAS})
                   await instance1.joinGame(gameHash, move2Hash, { from: user2, gas: MAX_GAS, value: GAME_PRICE});
                   await instance1.revealGame(gameHash, PAPER, fromAscii(PLAYER2_PWD), { from: user2, gas: MAX_GAS});
                   await jumpDeltaBlock(DELTA_BLKS+1);
                   let result = await instance1.cancelGame(gameHash, { from: user2, gas: MAX_GAS})
                   assert.strictEqual(result.logs.length, 1);
                   let logEvent = result.logs[0];

                   assert.strictEqual(logEvent.event, "LogGameCancelled", "LogGameCancelled event is wrong");
                   assert.strictEqual(logEvent.args.player, user2, "player2 is wrong");
                   assert.strictEqual(logEvent.args.gameHash, gameHash, "gameHash is wrong");
                   assert.strictEqual(logEvent.args.winnerId.toNumber(), 0, "winnerId is wrong"); 
                });
            });

            describe("#withdraw()", async function() {
                it("should OK if have funds",  async function() {
                  let instance1 = await RockPaperScissors.new({ from: owner , gas: MAX_GAS})
                  const gameHash = await instance1.gameHash(user1, user2, { from: user1, gas: MAX_GAS})
                  const move1Hash = await instance1.moveHash(user1, PAPER, fromAscii(PLAYER1_PWD), { from: user1, gas: MAX_GAS})
                  await instance1.newGame(gameHash, move1Hash, DELTA_BLKS, GAME_PRICE, { from: user1, gas: MAX_GAS, value: GAME_PRICE})
                  const move2Hash = await instance1.moveHash(user2, PAPER, fromAscii(PLAYER2_PWD), { from: user2, gas: MAX_GAS})
                  await instance1.joinGame(gameHash, move2Hash, { from: user2, gas: MAX_GAS, value: GAME_PRICE});
                  await instance1.revealGame(gameHash, PAPER, fromAscii(PLAYER1_PWD), { from: user1, gas: MAX_GAS});
                  await instance1.revealGame(gameHash, PAPER, fromAscii(PLAYER2_PWD), { from: user2, gas: MAX_GAS});

                  await instance1.withdraw({ from: user1, gas: MAX_GAS})
                  let payerBalance = await instance.balances(user1);  
                  assert.strictEqual(payerBalance.toString(), "0", "payer balances not zero after withdraw");
                });

                it("should fail if no funds",  async function() {
                  let instance1 = await RockPaperScissors.new({ from: owner , gas: MAX_GAS})
                  await web3.eth.expectedExceptionPromise(
                      () => { return instance1.withdraw({ from: user1, gas: MAX_GAS}); },
                      MAX_GAS);
                });

                it("verify the emitted event",  async function() {
                  let instance1 = await RockPaperScissors.new({ from: owner , gas: MAX_GAS})
                  const gameHash = await instance1.gameHash(user1, user2, { from: user1, gas: MAX_GAS})
                  const move1Hash = await instance1.moveHash(user1, PAPER, fromAscii(PLAYER1_PWD), { from: user1, gas: MAX_GAS})
                  await instance1.newGame(gameHash, move1Hash, DELTA_BLKS, GAME_PRICE, { from: user1, gas: MAX_GAS, value: GAME_PRICE})
                  const move2Hash = await instance1.moveHash(user2, PAPER, fromAscii(PLAYER2_PWD), { from: user2, gas: MAX_GAS})
                  await instance1.joinGame(gameHash, move2Hash, { from: user2, gas: MAX_GAS, value: GAME_PRICE});
                  await instance1.revealGame(gameHash, PAPER, fromAscii(PLAYER1_PWD), { from: user1, gas: MAX_GAS});
                  await instance1.revealGame(gameHash, PAPER, fromAscii(PLAYER2_PWD), { from: user2, gas: MAX_GAS});

                  let contractBalancePre  = await web3.eth.getBalance(instance1.address);
                  const contractBalancePreBN = new BN(contractBalancePre);
                  let userBalancePre  = await web3.eth.getBalance(user2);
                  const userBalancePreBN = new BN(userBalancePre);
        
                  let payerBalance = await instance1.balances(user2);  
                  const payerBalancePreBN = new BN(payerBalance);

                  const result = await instance1.withdraw({ from: user2, gas: MAX_GAS})
                  .should.be.fulfilled;

                  // calculates transaction total gas
                  let gasUsed = (result.receipt.gasUsed);
                  let gasUsedBN = new BN(gasUsed);
                  let receipt = await web3.eth.getTransaction(result.tx);
                  let gasPrice = receipt.gasPrice;
                  let gasPriceBN = new BN(gasPrice);
                  let totalGasBN = gasPriceBN.mul(gasUsedBN);

                  let userBalancePost  = await web3.eth.getBalance(user2);
                  const userBalancePostBN = new BN(userBalancePost);

                  // calculates expected user balances take account also GAS amount
                  let expectedUserBalance = userBalancePreBN.add(payerBalancePreBN).sub(totalGasBN);
                  assert.strictEqual(expectedUserBalance.toString(), userBalancePostBN.toString(), "user balances are not correct");
           
                  // verify the user balance after withdraw is 0
                  payerBalance = await instance1.balances(user2);  
                  assert.strictEqual(payerBalance.toString(), "0", "payer balances not zero after withdraw");

                  assert.strictEqual(result.logs.length, 1);
                  let logEvent = result.logs[0];
                  assert.strictEqual(logEvent.event, "LogWithdraw", "LogWithdraw name is wrong");
                  assert.strictEqual(logEvent.args.player, user2, "player is wrong");
              });
           });
       });
    });
});

