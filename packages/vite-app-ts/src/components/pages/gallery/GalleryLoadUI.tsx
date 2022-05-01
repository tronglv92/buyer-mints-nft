import { LinkOutlined } from '@ant-design/icons';
import { Button, Card, InputNumber, Modal } from 'antd';
import { format } from 'date-fns';
// import 'graphiql/graphiql.min.css';

import { Address } from 'eth-components/ant';
import { transactor } from 'eth-components/functions';
import { EthComponentsSettingsContext } from 'eth-components/models';
import { useBlockNumber, useEventListener, useGasPrice } from 'eth-hooks';
import { useEthersContext } from 'eth-hooks/context';
import { ethers, utils, constants } from 'ethers';
import React, { FC, useContext, useEffect, useState } from 'react';
import StackGrid from 'react-stack-grid';

import assets from '../../../assets';

import { useAppContracts } from '~~/components/contractContext';
import { IScaffoldAppProviders } from '~~/components/main/hooks/useScaffoldAppProviders';
// import GraphiQL from 'graphiql';

import { getNetworkInfo } from '~~/functions';
import { parseEther } from '@ethersproject/units';
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
  const yourAution = useAppContracts('Auction', ethersContext.chainId);
  const [loadedAssets, setLoadedAssets] = useState<any>([]);
  const [yourBid, setYourBid] = useState<Record<string, string>>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [auctionToken, setAuctionToken] = useState('');
  const [auctionDetails, setAuctionDetails] = useState({ price: '', duration: '' });
  const [blocknumber] = useBlockNumber(props.scaffoldAppProviders.localAdaptor?.provider, (blockNumber) =>
    console.log(`⛓ A new local block is here: ${blockNumber}`)
  );
  const [transferEvents, update] = useEventListener(yourContract, 'Transfer', blocknumber);
  const address = ethersContext.account;
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
  const updateYourCollectibles = async () => {
    const assetUpdate: any[] = [];
    const items: Record<string, any> = assets;
    if (yourContract && yourAution) {
      for (const a in items) {
        try {
          const forSale = await yourContract.forSale(ethers.utils.id(a));
          let owner;
          let auctionInfo;
          if (!forSale) {
            const tokenId = await yourContract.uriToTokenId(ethers.utils.id(a));
            owner = await yourContract.ownerOf(tokenId);
            const nftAddress = yourContract.address;
            auctionInfo = await yourAution.getTokenAuctionDetails(nftAddress, tokenId);
          }
          assetUpdate.push({ id: a, ...items[a], forSale, owner, auctionInfo });
        } catch (e) {
          console.log(e);
        }
      }
      console.log('assetUpdate ', assetUpdate);
      setLoadedAssets(assetUpdate);
    }
  };
  useEffect(() => {
    updateYourCollectibles();
  }, [assets, yourContract, transferEventsJsonString]);

  const placeBid = async (tokenUri: string, ethAmount: string) => {
    const tokenId = await yourContract?.uriToTokenId(utils.id(tokenUri));
    const nftAddress = yourContract?.address;
    if (tx) {
      console.log('gasPrice,', gasPrice);
      if (nftAddress && tokenId) {
        await tx(yourAution?.bid(nftAddress, tokenId, { value: parseEther(ethAmount.toString()) }));
      }
      updateYourCollectibles();
    }
  };
  const completeAuction = (tokenUri: string) => {
    return async () => {
      const tokenId = await yourContract?.uriToTokenId(utils.id(tokenUri));
      const nftAddress = yourContract?.address;
      if (nftAddress && tokenId && tx) {
        await tx(yourAution?.executeSale(nftAddress, tokenId));
        updateYourCollectibles();
      }
    };
  };
  const cancelAuction = (tokenUri: string) => {
    return async () => {
      const tokenId = await yourContract?.uriToTokenId(utils.id(tokenUri));
      const nftAddress = yourContract?.address;
      if (nftAddress && tokenId && tx) {
        await tx(yourAution?.cancelAuction(nftAddress, tokenId));
        updateYourCollectibles();
      }
    };
  };
  const startAuction = (tokenUri: string) => {
    return async () => {
      setAuctionToken(tokenUri);
      setModalVisible(true);
    };
  };
  const galleryList: any = [];
  for (const a in loadedAssets) {
    const cardActions = [];
    let auctionDetails = [];
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
      auctionDetails.push(null);
    } else {
      const { auctionInfo } = loadedAssets[a];
      const deadline = new Date(auctionInfo.duration * 1000);
      const isEnded = deadline <= new Date();

      cardActions.push(
        <div>
          <div>
            owned by:{' '}
            <Address
              address={loadedAssets[a].owner}
              ensProvider={props.scaffoldAppProviders.mainnetAdaptor?.provider}
              blockExplorer={props.scaffoldAppProviders.targetNetwork?.blockExplorer}
              minimized
            />
          </div>
          {!loadedAssets[a].auctionInfo.isActive && address === loadedAssets[a].owner && (
            <>
              <Button
                style={{ marginBottom: '10px' }}
                onClick={startAuction(loadedAssets[a].id)}
                disabled={address !== loadedAssets[a].owner}>
                Start auction
              </Button>
              <br />
            </>
          )}
          {loadedAssets[a].auctionInfo.isActive && address === loadedAssets[a].auctionInfo.seller && (
            <>
              <Button style={{ marginBottom: '10px' }} onClick={completeAuction(loadedAssets[a].id)}>
                Complete auction
              </Button>
              <br />
            </>
          )}
          {loadedAssets[a].auctionInfo.isActive && address === loadedAssets[a].auctionInfo.seller && (
            <>
              <Button style={{ marginBottom: '10px' }} onClick={cancelAuction(loadedAssets[a].id)}>
                Cancel auction
              </Button>
              <br />
            </>
          )}
        </div>
      );
      auctionDetails.push(
        auctionInfo.isActive ? (
          <div style={{ marginTop: '20px' }}>
            <p style={{ fontWeight: 'bold' }}>Auction is in progress</p>
            <p style={{ margin: 0, marginBottom: '2px' }}>
              Minimal price is {utils.formatEther(auctionInfo.price)} ETH
            </p>
            <p style={{ marginTop: 0 }}>
              {!isEnded ? `Auction ends at ${format(deadline, 'MMMM dd, hh:mm:ss')}` : 'Auction has already ended'}
            </p>
            <div>
              {auctionInfo.maxBidUser === constants.AddressZero ? (
                'Highest bid was not made yet'
              ) : (
                <div>
                  Highest bid by:{' '}
                  <Address
                    address={auctionInfo.maxBidUser}
                    ensProvider={props.scaffoldAppProviders.mainnetAdaptor?.provider}
                    blockExplorer={props.scaffoldAppProviders.targetNetwork.blockExplorer}
                    minimized={true}
                  />
                  <p>{utils.formatEther(auctionInfo.maxBid)} ETH</p>
                </div>
              )}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', marginTop: '20px' }}>
                <p style={{ margin: 0, marginRight: '15px' }}>Your bid in ETH: </p>
                <InputNumber
                  placeholder="0.1"
                  value={yourBid[loadedAssets[a].id]}
                  onChange={(newBid) => setYourBid({ ...yourBid, [loadedAssets[a].id]: newBid })}
                  style={{ flexGrow: 1 }}></InputNumber>
              </div>
              <Button
                style={{ marginTop: '7px' }}
                onClick={() => placeBid(loadedAssets[a].id, yourBid[loadedAssets[a].id])}
                disabled={!yourBid[loadedAssets[a].id] || isEnded}>
                Place a bid
              </Button>
            </div>
          </div>
        ) : null
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
        {auctionDetails}
      </Card>
    );
  }
  const handleOk = async () => {
    setModalVisible(false);
    const { price, duration } = auctionDetails;
    const tokenId = await yourContract?.uriToTokenId(utils.id(auctionToken));

    const auctionAddress = yourAution?.address;
    const nftAddress = yourContract?.address;
    if (auctionAddress && tokenId) await yourContract?.approve(auctionAddress, tokenId);

    const ethPrice = utils.parseEther(price.toString());
    const blockDuration = Math.floor(new Date().getTime() / 1000) + duration;

    if (tx && nftAddress && tokenId)
      await tx(yourAution?.createTokenAuction(nftAddress, tokenId, ethPrice, blockDuration));

    if (nftAddress && tokenId) {
      const auctionInfo = await yourAution?.getTokenAuctionDetails(nftAddress, tokenId);
      console.log('auctionInfo', { auctionInfo });
    }
  };

  const handleCancel = () => {
    setModalVisible(false);
  };
  return (
    <div style={{ maxWidth: 820, margin: 'auto', marginTop: 32, paddingBottom: 256 }}>
      <Button disabled={galleryList.length === 0} onClick={updateYourCollectibles} style={{ marginBottom: '25px' }}>
        Update collectibles
      </Button>
      <StackGrid columnWidth={200} gutterWidth={16} gutterHeight={16}>
        {galleryList}
      </StackGrid>
      <Modal
        title="Start auction"
        visible={modalVisible}
        onOk={handleOk}
        onCancel={handleCancel}
        okButtonProps={{ disabled: !auctionDetails.price || !auctionDetails.duration }}
        okText="Start">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <p style={{ margin: 0, marginRight: '15px' }}>ETH price (minimal bid): </p>
          <InputNumber
            placeholder="0.1"
            value={auctionDetails.price}
            onChange={(newPrice) => setAuctionDetails({ ...auctionDetails, price: newPrice })}
            style={{ flexGrow: 1 }}
          />
        </div>
        <br />
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <p style={{ margin: 0, marginRight: '15px' }}>Duration in seconds: </p>
          <InputNumber
            placeholder="3600"
            value={auctionDetails.duration}
            onChange={(newDuration) => setAuctionDetails({ ...auctionDetails, duration: newDuration })}
            style={{ flexGrow: 1 }}
          />
        </div>
      </Modal>
    </div>
  );
};

export default GalleryLoadUI;
