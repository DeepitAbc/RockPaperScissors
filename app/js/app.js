
require("file-loader?name=../index.html!../index.html");

const Web3 = require("web3");
const truffleContract = require("truffle-contract");
const $ = require("jquery");
// Not to forget our built contract
const rockPaperScissorsjson = require("../../build/contracts/RockPaperScissors.json");

// Supports Metamask, and other wallets that provide / inject 'web3'.
if (typeof web3 !== 'undefined') {
    // Use the Mist/wallet/Metamask provider.
    window.web3 = new Web3(web3.currentProvider);
} else {
    // Your preferred fallback.
    window.web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:9545')); 
}

const { sha3 } = window.web3.utils;

const RockPaperScissors = truffleContract(rockPaperScissorsjson);
RockPaperScissors.setProvider(web3.currentProvider);

window.addEventListener('load', async () => {

    console.log ("addEventListener called");
    const accounts = await window.web3.eth.getAccounts();
    if (accounts.length === 0) {
       console.log ("ERROR: No Account available");
       $("#contractBalance").html("NA");
       $("#player1Balance").html("NA");
       $("#player2Balance").html("NA");
       $("#status").html("No account with which to transact");
       $("#Winner").html("NONE");
       return;
    }
    console.log ("Assign accounts");
    let player1Account = accounts[0];
    let player2Account = accounts[1];
    let gameKey;
    let move1;
    let player1Secret;
    let winnerId=0;
    let deltaBlocks;

    network = await window.web3.eth.net.getId();
    console.log ("network",network.toString(10));
    let instance;

    try {
       console.log ("Try to get RockPaperScissors instance ...");
       instance = await RockPaperScissors.deployed();
    }
    catch(error) {
       $("#status").html("error to access node");
       $("#contractBalance").html("NA");
       $("#player1Balance").html("NA");
       $("#player2Balance").html("NA");
       $("#Winner").html("NONE");
       console.log ("Error:",error);
       return;
    }
    console.log ("contract Address",instance.address);

    await showInfo();

    $("#showInfo").click(async function(){
      console.log ("the showInfo was clicked.");
      await showInfo();
    }); 

    $("#newGame").click(async function(){
      console.log ("the newGame was clicked.");
      await newGame();
    }); 

    $("#joinGame").click(async function(){
      console.log ("the joinGame was clicked.");
      await joinGame();
    }); 

    $("#revealPlayer1").click(async function(){
      console.log ("the revealPlayer1 was clicked.");
      await revealPlayer1();
    }); 

    $("#revealPlayer2").click(async function(){
      console.log ("the revealPlayer2 was clicked.");
      await revealPlayer2();
    }); 

    $("#cancelGamePlayer1").click(async function(){
      console.log ("the cancelGamePlayer1 was clicked.");
      await cancelGame(player1Account);
    }); 

    $("#cancelGamePlayer2").click(async function(){
      console.log ("the cancelGamePlayer2 was clicked.");
      await cancelGame(player2Account);
    }); 

    $("#withdrawPlayer1").click(async function(){
      console.log ("the withdrawPlayer1 was clicked.");
      await withdraw(player1Account);
    }); 

    $("#withdrawPlayer2").click(async function(){
      console.log ("the withdrawPlayer2 was clicked.");
      await withdraw(player2Account);
    }); 

    async function jumpDeltaBlock(deltaBlock) {
       let i;
       for (i = 0; i < deltaBlock; i++)  {
          await window.web3.currentProvider.send({
              jsonrpc: '2.0',
              method: 'evm_mine',
              params: [],
              id: 0,
          })
       }
    }
    
    async function showInfo() {
       try {
          const blockNumber = await window.web3.eth.getBlockNumber();
          console.log("blockNumber=", blockNumber.toString(10));
          const contractBalance = await window.web3.eth.getBalance(instance.address);
          console.log ("Contract Balance",contractBalance);
          const player1Balance = await window.web3.eth.getBalance(player1Account);
          console.log("Account[Player1]=", player1Account,player1Balance.toString(10));
          const player2Balance = await window.web3.eth.getBalance(player2Account);
          console.log("Account[Player2]=", player2Account,player2Balance.toString(10));
          console.log("WinnerId=", winnerId.toString(10));

          $("#contractBalance").html(contractBalance.toString(10))
          $("#blockNumber").html(blockNumber.toString(10))
          $("#player1Balance").html(player1Balance.toString(10))
          $("#player2Balance").html(player2Balance.toString(10))
          $("#winnerId").html(winnerId.toString(10))
          $("#status").html("OK");
       }
       catch(error) {
          $("#status").html("error to retrive info");
          console.log ("Error:",error);
       }
    }

    async function newGame() {
       const GAS = 300000; 

       try {
           winnerId=0;
           $("#winnerId").html("NA")
           move1 = $('input:radio[name=move1Value]:checked').val()
           player1Secret = $("input[name='player1Secret']").val();
           deltaBlocks = $("input[name='expDeltaBlock']").val();
           let amount = $("input[name='amount']").val();
       
           console.log ("move1: ", move1);
           console.log ("player1Secret: ", player1Secret);
           console.log ("deltaBlocks: ", deltaBlocks);
           console.log ("amount: ", amount);
           let move1Hash = await instance.moveHash(player1Account, move1, sha3(player1Secret));
           console.log('move1Hash:',move1Hash);
           gameKey = move1Hash;

           let txObj = await instance.newGame(move1Hash, deltaBlocks, amount,
                { from: player1Account, gas: GAS, value: amount})
                .on("transactionHash",
                    txHash => $("#status").html("Transaction on the way " + txHash))

           const receipt = txObj.receipt;
           console.log("got receipt", receipt);
           if (!receipt.status) {
              console.error("Wrong status");
              console.error(receipt);
              $("#status").html("There was an error in the tx execution, status not 1");
           } else if (receipt.logs.length == 0) {
              console.error("Empty logs");
              console.error(receipt);
              $("#status").html("There was an error in the tx execution, missing expected event");
           } else {
              console.log(receipt.logs[0]);
              $("#status").html("Transfer executed");
         }
       }
       catch(error) {
          $("#status").html("transaction error");
          console.log ("Error:",error);
       }
    };

    async function joinGame() {
       const GAS = 300000; 

       try {
           let amount = $("input[name='amount']").val();
       
           console.log ("amount: ", amount);

           let txObj = await instance.joinGame(gameKey, 
                { from: player2Account, gas: GAS, value: amount})
                .on("transactionHash",
                    txHash => $("#status").html("Transaction on the way " + txHash))

           const receipt = txObj.receipt;
           console.log("got receipt", receipt);
           if (!receipt.status) {
              console.error("Wrong status");
              console.error(receipt);
              $("#status").html("There was an error in the tx execution, status not 1");
           } else if (receipt.logs.length == 0) {
              console.error("Empty logs");
              console.error(receipt);
              $("#status").html("There was an error in the tx execution, missing expected event");
           } else {
              console.log(receipt.logs[0]);
              $("#status").html("Transfer executed");
         }
       }
       catch(error) {
          $("#status").html("transaction error");
          console.log ("Error:",error);
       }
    }

    async function revealPlayer1() {
       const GAS = 300000; 

       try {
           let txObj = await instance.revealPlayer1(gameKey, move1, sha3(player1Secret),
                { from: player1Account, gas: GAS})
                .on("transactionHash",
                    txHash => $("#status").html("Transaction on the way " + txHash))

           const receipt = txObj.receipt;
           console.log("got receipt", receipt);
           if (!receipt.status) {
              console.error("Wrong status");
              console.error(receipt);
              $("#status").html("There was an error in the tx execution, status not 1");
           } else if (receipt.logs.length == 0) {
              console.error("Empty logs");
              console.error(receipt);
              $("#status").html("There was an error in the tx execution, missing expected event");
           } else {
              console.log(receipt.logs[0]);
              winnerId = receipt.logs[0].args.winnerId;
              console.log("WinnerId",winnerId.toString());
              $("#winnerId").html(winnerId.toString(10))
              $("#status").html("Transfer executed");
         }
       }
       catch(error) {
          $("#status").html("transaction error");
          console.log ("Error:",error);
       }
    }

    async function revealPlayer2() {
       const GAS = 300000; 

       try {
           let move2 = $('input:radio[name=move2Value]:checked').val()
           console.log ("move2:",move2);
           let txObj = await instance.revealPlayer2(gameKey, move2,
                { from: player2Account, gas: GAS})
                .on("transactionHash",
                    txHash => $("#status").html("Transaction on the way " + txHash))

           const receipt = txObj.receipt;
           console.log("got receipt", receipt);
           if (!receipt.status) {
              console.error("Wrong status");
              console.error(receipt);
              $("#status").html("There was an error in the tx execution, status not 1");
           } else if (receipt.logs.length == 0) {
              console.error("Empty logs");
              console.error(receipt);
              $("#status").html("There was an error in the tx execution, missing expected event");
           } else {
              console.log(receipt.logs[0]);
              $("#status").html("Transfer executed");
         }
       }
       catch(error) {
          $("#status").html("transaction error");
          console.log ("Error:",error);
       }
    }

    async function withdraw(address) {
       const GAS = 300000; 

       try {
           let txObj = await instance.withdraw({ from: address, gas: GAS})
                .on("transactionHash",
                    txHash => $("#status").html("Transaction on the way " + txHash))

           const receipt = txObj.receipt;
           console.log("got receipt", receipt);
           if (!receipt.status) {
              console.error("Wrong status");
              console.error(receipt);
              $("#status").html("There was an error in the tx execution, status not 1");
           } else if (receipt.logs.length == 0) {
              console.error("Empty logs");
              console.error(receipt);
              $("#status").html("There was an error in the tx execution, missing expected event");
           } else {
              console.log(receipt.logs[0]);
              $("#status").html("Transfer executed");
           }
         }
       
       catch(error) {
          $("#status").html("transaction error");
          console.log ("Error:",error);
       }
    };

    async function cancelGame(account) {
       const GAS = 300000; 

       try {
           let blockNumber = await window.web3.eth.getBlockNumber();
           console.log("currentBlock: ",blockNumber);
           await jumpDeltaBlock(deltaBlocks+1);
           blockNumber = await window.web3.eth.getBlockNumber();
           console.log("currentBlock: ",blockNumber);

           console.log('gameKey:',gameKey);
           let txObj = await instance.cancelGame(gameKey, { from: account, gas: GAS})
                .on("transactionHash",
                    txHash => $("#status").html("Transaction on the way " + txHash))

           const receipt = txObj.receipt;
           console.log("got receipt", receipt);
           if (!receipt.status) {
              console.error("Wrong status");
              console.error(receipt);
              $("#status").html("There was an error in the tx execution, status not 1");
           } else if (receipt.logs.length == 0) {
              console.error("Empty logs");
              console.error(receipt);
              $("#status").html("There was an error in the tx execution, missing expected event");
           } else {
              console.log(receipt.logs[0]);
              $("#status").html("Transfer executed");
              winnerId = receipt.logs[0].args.winnerId;
              console.log("WinnerId",winnerId.toString());
              $("#winnerId").html(winnerId.toString(10))
         }
       }
       catch(error) {
          $("#status").html("transaction error");
          console.log ("Error:",error);
       }
    };
});
