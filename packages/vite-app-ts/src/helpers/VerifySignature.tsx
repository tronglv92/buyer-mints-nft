import { TEthersProvider } from 'eth-hooks/models';
import { ethers } from 'ethers';
import { isValidSignature } from './eip1271';

export async function verifySignature(address: string, sig: string, hash: string, provider: TEthersProvider) {
  let messageToArray = ethers.utils.arrayify(hash);
  console.log('verifySignature messageToArray ', messageToArray);
  let arrayToHash = ethers.utils.hashMessage(messageToArray);
  const bytecode = await provider.getCode(address);
  //const bytecode = '0x00'; //await provider.getCode(address);/////force this for now because it is failing here
  console.log(bytecode);
  const signer = ethers.utils.verifyMessage(messageToArray, sig);
  console.log('verifySignature: signer ', signer);
  if (!bytecode || bytecode === '0x' || bytecode === '0x0' || bytecode === '0x00') {
    return signer.toLowerCase() === address.toLowerCase();
  } else {
    return isValidSignature(address, sig, arrayToHash, provider);
  }
}
