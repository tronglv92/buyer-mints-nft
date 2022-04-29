import { task } from 'hardhat/config';
import { create } from 'ipfs-http-client';

import fs from 'fs';
import { sleep } from './functions/utils';

task('upload', 'Upload assets', async (_, hre) => {
  const ipfs = create({
    host: 'ipfs.infura.io',
    port: 5001,
    protocol: 'https',
  });
  let allAssets: Record<string, string> = {};
  // // // // // // // // // // // // // // // // // //
  const delay = 4000;
  console.log('\n\n Loading artwork.json...\n');
  const artwork = JSON.parse(fs.readFileSync('../../artwork.json').toString());

  for (let a in artwork) {
    console.log('  Uploading ' + artwork[a].name + '...');
    const stringJSON = JSON.stringify(artwork[a]);
    const uploaded = await ipfs.add(stringJSON);
    console.log(' ' + artwork[a].name + ' ipfs:' + uploaded.path);
    allAssets[uploaded.path] = artwork[a];
    await sleep(delay);
  }

  console.log('\n Injecting assets into the frontend...');
  const finalAssetFile = 'export default ' + JSON.stringify(allAssets) + '';
  fs.writeFileSync('../vite-app-ts/src/assets.tsx', finalAssetFile);
  fs.writeFileSync('./uploaded.json', JSON.stringify(allAssets));
  /*


  console.log("Minting zebra...")
  await yourCollectible.mintItem("0xD75b0609ed51307E13bae0F9394b5f63A7f8b6A1","zebra.jpg")

  */

  // const secondContract = await deploy("SecondContract")

  // const exampleToken = await deploy("ExampleToken")
  // const examplePriceOracle = await deploy("ExamplePriceOracle")
  // const smartContractWallet = await deploy("SmartContractWallet",[exampleToken.address,examplePriceOracle.address])

  /*
  //If you want to send value to an address from the deployer
  const deployerWallet = ethers.provider.getSigner()
  await deployerWallet.sendTransaction({
    to: "0x34aA3F359A9D614239015126635CE7732c18fDF3",
    value: ethers.utils.parseEther("0.001")
  })
  */

  /*
  //If you want to send some ETH to a contract on deploy (make your constructor payable!)
  const yourContract = await deploy("YourContract", [], {
  value: ethers.utils.parseEther("0.05")
  });
  */

  /*
  //If you want to link a library into your contract:
  // reference: https://github.com/austintgriffith/scaffold-eth/blob/using-libraries-example/packages/hardhat/scripts/deploy.js#L19
  const yourContract = await deploy("YourContract", [], {}, {
   LibraryName: **LibraryAddress**
  });
  */
});
