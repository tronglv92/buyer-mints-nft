import { LinkOutlined } from '@ant-design/icons';
import { Button, Card } from 'antd';

// import 'graphiql/graphiql.min.css';

import { Address } from 'eth-components/ant';
import { transactor } from 'eth-components/functions';
import { EthComponentsSettingsContext } from 'eth-components/models';
import { useBlockNumber, useEventListener, useGasPrice } from 'eth-hooks';
import { useEthersContext } from 'eth-hooks/context';
import { ethers } from 'ethers';
import React, { FC, useContext, useEffect, useState } from 'react';
import StackGrid from 'react-stack-grid';

import assets from '../../../assets';

import { useAppContracts } from '~~/components/contractContext';
import { IScaffoldAppProviders } from '~~/components/main/hooks/useScaffoldAppProviders';
// import GraphiQL from 'graphiql';

import { getNetworkInfo } from '~~/functions';
// const GraphiQL = lazy(() => import('graphiql'));

export interface IGalleryUIProps {
  scaffoldAppProviders: IScaffoldAppProviders;
}

/**
 * Subgraph also disabled in MainPageMenu, it does not work, see github issue https://github.com/scaffold-eth/scaffold-eth-typescript/issues/48!
 * @param props
 * @returns
 */
export const GalleryLoadUI: FC<IGalleryUIProps> = (props) => {
  const ethersContext = useEthersContext();
  const yourContract = useAppContracts('YourNFT', ethersContext.chainId);

  const [loadedAssets, setLoadedAssets] = useState<any>([]);
  const [blocknumber] = useBlockNumber(props.scaffoldAppProviders.localAdaptor?.provider, (blockNumber) =>
    console.log(`⛓ A new local block is here: ${blockNumber}`)
  );
  const [transferEvents, update] = useEventListener(yourContract, 'Transfer', blocknumber);
  // console.log('blocknumber ', blocknumber);
  // console.log('transferEvents ', transferEvents);
  // console.log('transferEvents : ', transferEvents);

  // const check2: TypedEvent<ethers.utils.Result>[] = [];
  // const check3: TypedEvent<ethers.utils.Result>[] = [];

  // const check3: number[] = [];
  // console.log('check2 ==  check3 ', check2 == check3);
  const transferEventsJsonString = JSON.stringify(transferEvents);
  const signer = props.scaffoldAppProviders.localAdaptor?.signer;
  const settingsContext = useContext(EthComponentsSettingsContext);
  const tx = transactor(settingsContext, signer, undefined, undefined, true);

  /* 🔥 This hook will get the price of Gas from ⛽️ EtherGasStation */
  const [gasPrice] = useGasPrice(ethersContext.chainId, 'fast', getNetworkInfo(ethersContext.chainId));

  useEffect(() => {
    const updateYourCollectibles = async () => {
      const assetUpdate: any[] = [];
      const items: Record<string, any> = assets;
      for (const a in items) {
        try {
          const forSale = await yourContract?.forSale(ethers.utils.id(a));
          let owner;
          if (!forSale) {
            const tokenId = await yourContract?.uriToTokenId(ethers.utils.id(a));
            if (tokenId) owner = await yourContract?.ownerOf(tokenId);
          }
          assetUpdate.push({ id: a, ...items[a], forSale, owner });
        } catch (e) {
          console.log(e);
        }
      }
      console.log('assetUpdate ', assetUpdate);
      setLoadedAssets(assetUpdate);
    };
    updateYourCollectibles();
  }, [assets, yourContract, transferEventsJsonString]);
  const galleryList: any = [];
  for (const a in loadedAssets) {
    const cardActions = [];
    if (loadedAssets[a].forSale) {
      cardActions.push(
        <div>
          <Button
            onClick={() => {
              if (tx) {
                console.log('gasPrice,', gasPrice);
                tx(yourContract?.mintItem(loadedAssets[a].id))
                  .then(() => {})
                  .catch(() => {});
              }
            }}>
            Mint
          </Button>
        </div>
      );
    } else {
      cardActions.push(
        <div>
          owned by:{' '}
          <Address
            address={loadedAssets[a].owner}
            ensProvider={props.scaffoldAppProviders.mainnetAdaptor?.provider}
            blockExplorer={props.scaffoldAppProviders.targetNetwork?.blockExplorer}
            minimized
          />
        </div>
      );
    }
    galleryList.push(
      <Card
        style={{ width: 200 }}
        key={loadedAssets[a].name}
        actions={cardActions}
        title={
          <div>
            {loadedAssets[a].name}{' '}
            <a
              style={{ cursor: 'pointer', opacity: 0.33 }}
              href={loadedAssets[a].external_url}
              target="_blank"
              rel="noreferrer">
              <LinkOutlined />
            </a>
          </div>
        }>
        <img style={{ maxWidth: 130 }} src={loadedAssets[a].image} alt="" />
        <div style={{ opacity: 0.77 }}>{loadedAssets[a].description}</div>
      </Card>
    );
  }
  return (
    <div style={{ maxWidth: 820, margin: 'auto', marginTop: 32, paddingBottom: 256 }}>
      <StackGrid columnWidth={200} gutterWidth={16} gutterHeight={16}>
        {galleryList}
      </StackGrid>
    </div>
  );
};

export default GalleryLoadUI;
