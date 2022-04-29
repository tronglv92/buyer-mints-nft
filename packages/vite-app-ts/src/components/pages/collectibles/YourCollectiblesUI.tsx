import { Button, Card, List } from 'antd';
import axios from 'axios';
import { Address, AddressInput } from 'eth-components/ant';
import { transactor } from 'eth-components/functions';
import { EthComponentsSettingsContext } from 'eth-components/models';
import { useContractReader, useBalance } from 'eth-hooks';
import { useEthersContext } from 'eth-hooks/context';
import { mergeDefaultUpdateOptions } from 'eth-hooks/functions';
import React, { FC, useContext, useEffect, useState } from 'react';

import { useAppContracts } from '~~/components/contractContext';
import { IScaffoldAppProviders } from '~~/components/main/hooks/useScaffoldAppProviders';
export interface IYourCollectiblesUIProps {
  scaffoldAppProviders: IScaffoldAppProviders;
}
const getFromIPFS = async (hashToGet: string) => {
  const meta = await axios.get(hashToGet);
  console.log('meta ', meta.data);
  return meta.data;
};
export const YourCollectiblesUI: FC<IYourCollectiblesUIProps> = (props) => {
  const [yourCollectibles, setYourCollectibles] = useState<any>([]);
  const [transferToAddresses, setTransferToAddresses] = useState<Record<string, string | undefined>>({});

  const ethersContext = useEthersContext();
  const signer = props.scaffoldAppProviders.localAdaptor?.signer;
  const settingsContext = useContext(EthComponentsSettingsContext);
  const yourContract = useAppContracts('YourNFT', ethersContext.chainId);
  const tx = transactor(settingsContext, signer, undefined, undefined, true);
  const address = ethersContext.account;
  console.log('address ', address);

  const [balance] = useContractReader(yourContract, yourContract?.balanceOf, [address ?? '']);
  console.log('🤗 balance:', balance);

  const mainnetAdaptor = props.scaffoldAppProviders.mainnetAdaptor;
  // 🏗 scaffold-eth is full of handy hooks like this one to get your balance:
  const [yourLocalBalance] = useBalance(ethersContext.account);
  // Just plug in different 🛰 providers to get your balance on different chains:
  const [yourMainnetBalance, yUpdate, yStatus] = useBalance(ethersContext.account, mergeDefaultUpdateOptions(), {
    adaptorEnabled: true,
    adaptor: mainnetAdaptor,
  });
  const yourBalance = balance && balance.toNumber && balance.toNumber();
  // console.log('yourLocalBalance ', yourLocalBalance.toString());
  // console.log('yourMainnetBalance ', yourMainnetBalance.toBigInt().toString());
  useEffect(() => {
    const updateCollectibles = async () => {
      const collectiblesUpdate = [];

      if (address && yourBalance) {
        for (let tokenIndex = 0; tokenIndex < yourBalance; tokenIndex++) {
          try {
            console.log('GEtting token index', tokenIndex);
            const tokenId = await yourContract?.tokenOfOwnerByIndex(address, tokenIndex);
            console.log('tokenId', tokenId);
            if (tokenId) {
              const tokenURI = await yourContract?.tokenURI(tokenId);
              console.log('tokenURI', tokenURI);
              if (tokenURI) {
                const jsonManifest = await getFromIPFS(tokenURI);

                collectiblesUpdate.push({ id: tokenId, uri: tokenURI, owner: address, ...jsonManifest });
              }
            }

            // const ipfsHash = uri?.replace(/{(.*?)}/, collectibleIndex.toString());
            // const ipfsHash = uri?.replace('https://ipfs.io/ipfs/', '');
          } catch (e) {
            console.log(e);
          }
        }
        console.log('collectiblesUpdate ', collectiblesUpdate);
        setYourCollectibles(collectiblesUpdate);
      }
    };
    updateCollectibles();
  }, [address, yourBalance]);

  return (
    <>
      <div style={{ width: 640, margin: 'auto', marginTop: 32, paddingBottom: 32 }}>
        <List
          bordered
          dataSource={yourCollectibles ?? []}
          renderItem={(item: any) => {
            const id = item.id.toNumber();
            return (
              <List.Item key={id + '_' + item.uri + '_' + item.owner}>
                <Card
                  title={
                    <div>
                      <span style={{ fontSize: 16, marginRight: 8 }}>#{id}</span> {item.name}
                    </div>
                  }>
                  <div>
                    <img src={item.image} style={{ maxWidth: 150 }} />
                  </div>
                  <div>{item.description}</div>
                </Card>

                <div>
                  owned:{' '}
                  <Address
                    address={item.owner}
                    ensProvider={props.scaffoldAppProviders.mainnetAdaptor?.provider}
                    blockExplorer={props.scaffoldAppProviders.targetNetwork.blockExplorer}
                    fontSize={16}
                  />
                  <AddressInput
                    ensProvider={props.scaffoldAppProviders.mainnetAdaptor?.provider}
                    placeholder="transfer to address"
                    address={transferToAddresses[id]}
                    onChange={(newValue) => {
                      const update: Record<string, string> = {};
                      update[id] = newValue.toString();
                      setTransferToAddresses({ ...transferToAddresses, ...update });
                    }}
                  />
                  <Button
                    onClick={() => {
                      const toAddress = transferToAddresses[id];
                      if (tx && yourContract && address && toAddress) {
                        tx(yourContract?.transferFrom(address, toAddress, id))
                          .then(() => {})
                          .catch(() => {});
                      }
                    }}>
                    Transfer
                  </Button>
                </div>
              </List.Item>
            );
          }}
        />
      </div>
    </>
  );
};
export default YourCollectiblesUI;
