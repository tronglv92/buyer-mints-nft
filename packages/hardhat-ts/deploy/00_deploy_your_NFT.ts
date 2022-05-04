import { DeployFunction } from 'hardhat-deploy/types';
import { THardhatRuntimeEnvironmentExtended } from 'helpers/types/THardhatRuntimeEnvironmentExtended';
import fs from 'fs';
import { ethers } from 'hardhat';
import path from 'path';
const func: DeployFunction = async (hre: THardhatRuntimeEnvironmentExtended) => {
  const { getNamedAccounts, deployments } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log('\n\n 📡 Deploying...\n');

  // read in all the assets to get their IPFS hash...

  let uploadedAssets = JSON.parse(fs.readFileSync('./uploaded.json', 'utf-8'));

  let bytes32Array = [];
  // a is key: hash of ipfs
  for (let a in uploadedAssets) {
    console.log(' 🏷 IPFS:', a);
    let bytes32 = ethers.utils.id(a);
    console.log(' #️⃣ hashed:', bytes32);
    bytes32Array.push(bytes32);
  }
  console.log(' \n');
  await deploy('YourNFT', {
    // Learn more about args here: https://www.npmjs.com/package/hardhat-deploy#deploymentsdeploy
    from: deployer,
    args: [bytes32Array],
    log: true,
  });

  /*
    // Getting a previously deployed contract
    const YourContract = await ethers.getContract("YourContract", deployer);
    await YourContract.setPurpose("Hello");

    //const yourContract = await ethers.getContractAt('YourContract', "0xaAC799eC2d00C013f1F11c37E654e59B0429DF6A") //<-- if you want to instantiate a version of a contract at a specific address!
  */
};
export default func;
func.tags = ['YourNFT'];

/*
Tenderly verification
let verification = await tenderly.verify({
  name: contractName,
  address: contractAddress,
  network: targetNetwork,
});
*/
