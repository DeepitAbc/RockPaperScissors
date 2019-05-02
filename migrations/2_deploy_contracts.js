
const Remittance = artifacts.require('Remittance.sol');

module.exports = async (deployer, network, accounts) => {

 await deployer.deploy(Remittance, 100);

};



