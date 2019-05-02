
const RockPaperScissors = artifacts.require('RockPaperScissors.sol');

module.exports = async (deployer, network, accounts) => {

 await deployer.deploy(RockPaperScissors);

};



