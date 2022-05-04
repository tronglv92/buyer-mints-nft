import { notification } from 'antd';
import { TEthersProvider } from 'eth-hooks/models';
import { ethers } from 'ethers';
import { verifySignature } from './VerifySignature';

export async function getSignature(provider: TEthersProvider, signingAddress: string, types: any[], values: any[]) {
  if (provider) {
    console.log('INK', provider, signingAddress, types, values);
    let hashToSign = ethers.utils.solidityKeccak256(
      types, //['bytes','bytes','address','address','string','string','uint256'],
      values //['0x19','0x0',contract.address,artist,inkUrl,jsonUrl,limit])
    );
    console.log('hashToSign', hashToSign);
    try {
      let signature = await provider.send('personal_sign', [hashToSign, signingAddress]);
      let signerSignedMessage = await verifySignature(signingAddress, signature, hashToSign, provider);
      console.log('signature', signature);
      if (signerSignedMessage) {
        return signature;
      } else {
        throw console.log('Signer is not the signingAddress!');
      }
    } catch (e) {
      notification.error({
        message: 'Signature fail',
        description: e.message,
      });
      throw console.log('getSignature e', e);
    }
  }
}
