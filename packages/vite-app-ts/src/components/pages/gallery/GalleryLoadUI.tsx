import { LinkOutlined } from '@ant-design/icons';
import { Button, Card, InputNumber, Modal, notification } from 'antd';
import { format } from 'date-fns';
// import 'graphiql/graphiql.min.css';

import { Address } from 'eth-components/ant';
import { transactor } from 'eth-components/functions';
import { EthComponentsSettingsContext } from 'eth-components/models';
import { useBlockNumber, useContractReader, useEventListener, useGasPrice } from 'eth-hooks';
import { useEthersContext } from 'eth-hooks/context';
import { ethers, utils, constants, BigNumber } from 'ethers';
import React, { FC, useContext, useEffect, useState } from 'react';
import StackGrid from 'react-stack-grid';

import assets from '../../../assets';

import { useAppContracts } from '~~/components/contractContext';
import { IScaffoldAppProviders } from '~~/components/main/hooks/useScaffoldAppProviders';
// import GraphiQL from 'graphiql';

import { getNetworkInfo } from '~~/functions';
import { formatEther, parseEther } from '@ethersproject/units';
import { getSignature } from '../../../helpers/getSignature';
import { Auction } from '~~/generated/contract-types';
import _ from 'lodash';
// const GraphiQL = lazy(() => import('graphiql'));

export interface IGalleryUIProps {
  scaffoldAppProviders: IScaffoldAppProviders;
}

export interface IAssetProps {
  id: string;
  name: string;
  description: string;
  external_url: string;
  image: string;
  attributes: any[];
  forSale: boolean;
  mint: boolean;
  owner: string | undefined;
  price: BigNumber;
  seller: string | undefined;

  auctionInfo: Auction.TokenDetailsStructOutput;
  bidsInfo: Record<string, any>;
  stake: BigNumber;
  maxBidInfo: any;
}
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
// 😬 Sorry for all the console logging
const DEBUG = false;
/**
 * Subgraph also disabled in MainPageMenu, it does not work, see github issue https://github.com/scaffold-eth/scaffold-eth-typescript/issues/48!
 * @param props
 * @returns
 */
export const GalleryLoadUI: FC<IGalleryUIProps> = (props) => {
  const ethersContext = useEthersContext();
  const yourNFT = useAppContracts('YourNFT', ethersContext.chainId);
  const yourAution = useAppContracts('Auction', ethersContext.chainId);
  const [loadedAssets, setLoadedAssets] = useState<IAssetProps[]>([]);
  const [yourBid, setYourBid] = useState<Record<string, string>>({});
  const [stakedAmount, setStakedAmount] = useState<Record<string, string>>({});
  const [modalAuctionVisible, setModalAuctionVisible] = useState(false);
  const [modalSaleVisible, setModalSaleVisible] = useState(false);
  const [auctionToken, setAuctionToken] = useState('');
  const [auctionDetails, setAuctionDetails] = useState({ price: '', duration: '' });
  const [saleDetail, setSaleDetail] = useState({ tokenUri: '', price: '' });

  const [blocknumber] = useBlockNumber(props.scaffoldAppProviders.localAdaptor?.provider, (blockNumber) =>
    console.log(`⛓ A new local block is here: ${blockNumber}`)
  );
  const [transferEvents, update] = useEventListener(yourNFT, 'Transfer', blocknumber);
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

  const [stakedEth] = useContractReader(yourAution, yourAution?.getTotalBidderStake, [address ?? ZERO_ADDRESS]);
  if (DEBUG) console.log('🤗 stakedEth:', stakedEth);
  /* 🔥 This hook will get the price of Gas from ⛽️ EtherGasStation */
  const [gasPrice] = useGasPrice(ethersContext.chainId, 'fast', getNetworkInfo(ethersContext.chainId));
  const updateYourCollectibles = async () => {
    const assetUpdate: IAssetProps[] = [];
    const items: Record<string, any> = assets;

    if (yourNFT && yourAution && address) {
      for (const a in items) {
        try {
          const item = await yourNFT.forSale(ethers.utils.id(a));

          let owner = item.ownerItem;

          let seller = item.sellerItem;
          let auctionInfo;
          let stake: BigNumber = BigNumber.from(0);
          let bidsInfo: Record<string, any> = {};
          let maxBidInfo;

          // owner = item.owner;
          // let seller = item.seller;
          if (item.mint && item.tokenId) {
            const nftAddress = yourNFT.address;
            // console.log('tokenId ', tokenId);
            // console.log('nftAddress ', nftAddress);
            auctionInfo = await yourAution.getTokenAuctionDetails(nftAddress, item.tokenId);
            stake = await yourAution.getStakeInfo(nftAddress, item.tokenId, address);

            try {
              // console.log(`http://localhost:8001/${a}`);
              let data = await fetch(`http://localhost:8001/${a}`).then((data) => data.json());
              // console.log('data ', data);
              bidsInfo = data.transaction ?? {};
              maxBidInfo = data.maxBidInfo;
            } catch (e) {
              console.log('updateYourCollectibles bidsInfo', e);
              bidsInfo = {};
              maxBidInfo = undefined;
            }
          }

          assetUpdate.push({
            id: a,
            ...items[a],
            forSale: item.sale,
            owner,
            auctionInfo,
            bidsInfo,
            stake,
            maxBidInfo,
            price: item.price,
            seller,
            mint: item.mint,
          });
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
  }, [assets, yourNFT, transferEventsJsonString]);

  const stakeEth = async (loadedAsset: IAssetProps) => {
    const nftAddress = yourNFT?.address;
    const tokenId = await yourNFT?.uriToTokenId(utils.id(loadedAsset.id));
    if (tx && nftAddress && tokenId) {
      await tx(yourAution?.stake(nftAddress, tokenId, { value: parseEther(stakedAmount[loadedAsset.id].toString()) }));

      await updateYourCollectibles();
    }
  };
  const withdrawStake = async (loadedAsset: IAssetProps) => {
    const nftAddress = yourNFT?.address;
    const tokenId = await yourNFT?.uriToTokenId(utils.id(loadedAsset.id));
    if (tx && nftAddress && tokenId) {
      await tx(yourAution?.withdrawStake(nftAddress, tokenId));
      await updateYourCollectibles();
    }
  };
  const isBidderIncluded = (bidsInfo: Record<string, any>) => {
    const bidders = Object.entries(bidsInfo).map(([_, bidInfo]) => bidInfo.bidder);

    return bidders.includes(address);
  };

  const placeBid = async (loadedAsset: IAssetProps, ethAmount: string) => {
    const tokenUri = loadedAsset.id;
    const tokenId = await yourNFT?.uriToTokenId(utils.id(tokenUri));
    const nftAddress = yourNFT?.address;
    const parsedAmount = parseEther(ethAmount.toString());
    const minPrice = loadedAsset.auctionInfo.price;
    let maxBid = BigNumber.from(0);
    if (loadedAsset.maxBidInfo) {
      maxBid = BigNumber.from(loadedAsset.maxBidInfo.amount);
    }
    console.log('maxbid ', maxBid.toString());
    console.log('parsedAmount ', parsedAmount.toString());
    if (parsedAmount.gt(loadedAsset.stake) || parsedAmount.lt(minPrice)) {
      return notification.error({
        message: 'Invalid amount for bid',
        description:
          'This bid is not allowed. It is either less than minium price or you do not have enough staked ETH.',
      });
    }
    if (parsedAmount.lte(maxBid)) {
      return notification.error({
        message: 'Invalid amount for bid',
        description: 'This bid is not allowed. It must greater than the maximum bid',
      });
    }
    let currentProvider = props.scaffoldAppProviders?.currentProvider;
    console.log('placeBid currentProvider ', currentProvider);
    if (currentProvider && address && tokenId) {
      const signature = await getSignature(
        currentProvider,
        address,
        ['uint256', 'address', 'address', 'uint256'],
        [tokenId, nftAddress, address, parsedAmount]
      );
      await fetch('http://localhost:8001/', {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: tokenUri,
          hash: signature,
          id: tokenId.toString(),
          nft: nftAddress,
          bidder: address,
          amount: parsedAmount.toString(),
        }),
      });
      updateYourCollectibles();
    } else {
      console.log('placeBid: currentProvider,address,tokenId is null', currentProvider, address, tokenId);
    }
  };
  const completeAuction = async (loadedAsset: IAssetProps, bidInfo: any) => {
    console.log('WINNER:', loadedAsset, bidInfo);
    if (yourNFT && tx) {
      const nftAddress = yourNFT.address;
      const tokenId = await yourNFT.uriToTokenId(utils.id(loadedAsset.id));
      // const signedBid = {
      //   id: tokenId,
      //   nft: nftAddress,
      //   bidder: bidInfo.bidder,
      //   amount: BigNumber.from(bidInfo.amount),
      // };
      // console.log('signedBid', { signedBid });
      console.log('bidInfo ', bidInfo);
      await tx(
        yourAution?.executeSale(nftAddress, tokenId, bidInfo.bidder, BigNumber.from(bidInfo.amount), bidInfo.hash)
      );
      updateYourCollectibles();
      clearTokenUri(loadedAsset.id);
    } else {
      console.log('completeAuction: Error: yourContract or tx is null');
    }

    // return async () => {
    //   const tokenId = await yourContract?.uriToTokenId(utils.id(tokenUri));
    //   const nftAddress = yourContract?.address;
    //   if (nftAddress && tokenId && tx) {
    //     await tx(yourAution?.executeSale(nftAddress, tokenId));
    //     updateYourCollectibles();
    //   }
    // };
  };
  const clearTokenUri = async (tokenUri: string) => {
    await fetch('http://localhost:8001/clearAddress', {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: tokenUri,
      }),
    });
    updateYourCollectibles();
  };
  const cancelAuction = async (loadedAsset: IAssetProps) => {
    const tokenUri = loadedAsset.id;
    const { bidsInfo } = loadedAsset;

    const bidders = Object.entries(bidsInfo).map(([_, bidsInfo]) => bidsInfo.bidder);

    const tokenId = await yourNFT?.uriToTokenId(utils.id(tokenUri));
    const nftAddress = yourNFT?.address;
    console.log('nftAddress ', nftAddress);
    console.log('tokenId ', tokenId?.toString());
    if (nftAddress && tokenId && tx) {
      await tx(yourAution?.cancelAuction(nftAddress, tokenId));
      updateYourCollectibles();
      clearTokenUri(tokenUri);
    }
  };

  const startAuction = (tokenUri: string) => {
    return async () => {
      setAuctionToken(tokenUri);
      setModalAuctionVisible(true);
    };
  };
  const startSale = async (tokenUri: string) => {
    setSaleDetail({ ...saleDetail, tokenUri: tokenUri });
    setModalSaleVisible(true);
  };
  const onBuyItem = async (loadedAsset: IAssetProps) => {
    if (tx) {
      const tokenId = await yourNFT?.uriToTokenId(utils.id(loadedAsset.id));
      console.log('tokenId,', tokenId?.toString());
      console.log('address ', yourNFT?.address);
      tx(yourNFT?.buyItem(loadedAsset.id, { value: loadedAsset.price }))
        .then(() => {})
        .catch(() => {});
    }
  };
  const onCancelSale = async (loadedAsset: IAssetProps) => {
    if (tx) {
      const tokenId = await yourNFT?.uriToTokenId(utils.id(loadedAsset.id));
      console.log('tokenId,', tokenId?.toString());
      console.log('address ', yourNFT?.address);
      tx(yourNFT?.cancelSaleItem(loadedAsset.id))
        .then(() => {})
        .catch(() => {});
    }
  };
  const galleryList: any = [];
  for (const a in loadedAssets) {
    const cardActions = [];
    let auctionDetails = [];

    if (loadedAssets[a].forSale) {
      cardActions.push(
        <>
          {loadedAssets[a].mint == false && (
            <div>
              <Button
                onClick={() => {
                  console.log(
                    'parseEther(loadedAssets[a].price.toString())',
                    loadedAssets[a].price.toString().toString()
                  );
                  if (tx) {
                    console.log('gasPrice,', gasPrice);
                    tx(yourNFT?.mintItem(loadedAssets[a].id, { value: loadedAssets[a].price }))
                      .then(() => {})
                      .catch(() => {});
                  }
                }}>
                Mint
              </Button>
            </div>
          )}
          {loadedAssets[a].mint == true && (
            <>
              <div>
                Seller by
                <Address
                  address={loadedAssets[a].seller}
                  ensProvider={props.scaffoldAppProviders.mainnetAdaptor?.provider}
                  blockExplorer={props.scaffoldAppProviders.targetNetwork?.blockExplorer}
                  minimized
                />
              </div>
              {loadedAssets[a].seller != address ? (
                <Button onClick={() => onBuyItem(loadedAssets[a])}>Buy</Button>
              ) : (
                <Button onClick={() => onCancelSale(loadedAssets[a])}>Cancel Sale</Button>
              )}
            </>
          )}
        </>
      );
      auctionDetails.push(null);
    } else {
      const { auctionInfo, stake, maxBidInfo } = loadedAssets[a];
      // console.log('maxBidInfo ', maxBidInfo);
      const deadline = new Date(auctionInfo.duration.toNumber() * 1000);
      const isEnded = deadline <= new Date();
      const { bidsInfo } = loadedAssets[a];

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
          {!loadedAssets[a].auctionInfo.isActive && address === loadedAssets[a].owner && (
            <>
              <Button
                style={{ marginBottom: '10px' }}
                onClick={() => startSale(loadedAssets[a].id)}
                disabled={address !== loadedAssets[a].owner}>
                Start Sale
              </Button>
              <br />
            </>
          )}
          {isEnded &&
            loadedAssets[a].auctionInfo.isActive &&
            address === loadedAssets[a].auctionInfo.seller &&
            _.isEmpty(loadedAssets[a].maxBidInfo) == false && (
              <>
                <Button
                  style={{ marginBottom: '10px' }}
                  onClick={() => {
                    completeAuction(loadedAssets[a], loadedAssets[a].maxBidInfo);
                  }}>
                  Complete auction
                </Button>
                <br />
              </>
            )}
          {loadedAssets[a].auctionInfo.isActive && address === loadedAssets[a].auctionInfo.seller && (
            <>
              <Button style={{ marginBottom: '10px' }} onClick={() => cancelAuction(loadedAssets[a])}>
                Cancel auction
              </Button>
              <br />
            </>
          )}
          {auctionInfo.isActive && address != auctionInfo.seller && (
            <>
              <p style={{ margin: 0, marginTop: '15px', marginBottom: '2px' }}>
                Your staked ETH: {stake ? formatEther(stake) : 0.0}
              </p>
              {!isEnded && (
                <>
                  <p style={{ margin: 0, marginRight: '15px' }}>How much ETH you want to stake: </p>
                  <InputNumber
                    placeholder="0.1"
                    value={stakedAmount[loadedAssets[a].id]}
                    onChange={(newStake) => setStakedAmount({ ...stakedAmount, [loadedAssets[a].id]: newStake })}
                    style={{ flexGrow: 1, marginTop: '7px', marginBottom: '20px', marginRight: '15px' }}
                  />
                  <Button
                    disabled={!stakedAmount[loadedAssets[a].id]}
                    onClick={() => stakeEth(loadedAssets[a])}
                    style={{ marginBottom: '10px' }}>
                    Stake ETH
                  </Button>
                  <br />
                  <br />
                </>
              )}
            </>
          )}
          {auctionInfo.seller != ZERO_ADDRESS && address != auctionInfo.seller && stake.gt(BigNumber.from(0)) && (
            <>
              {(isEnded || auctionInfo.isActive == false) && (
                <>
                  <p>ETH stake: {ethers.utils.formatEther(stake)}</p>
                  <Button
                    disabled={!loadedAssets[a].stake}
                    onClick={() => withdrawStake(loadedAssets[a])}
                    style={{ marginBottom: '15px' }}>
                    Withdraw your stake
                  </Button>
                </>
              )}
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
              {_.isEmpty(maxBidInfo) === true ? (
                'Highest bid was not made yet'
              ) : (
                <div>
                  Highest bid by:{' '}
                  <Address
                    address={maxBidInfo.bidder}
                    ensProvider={props.scaffoldAppProviders.mainnetAdaptor?.provider}
                    blockExplorer={props.scaffoldAppProviders.targetNetwork.blockExplorer}
                    minimized={true}
                  />
                  <p>{utils.formatEther(maxBidInfo.amount)} ETH</p>
                </div>
              )}
            </div>

            {auctionInfo.seller !== address ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', marginTop: '20px' }}>
                  <p style={{ margin: 0, marginRight: '15px' }}>Your bid in ETH: </p>
                  <InputNumber
                    placeholder="0.1"
                    value={yourBid[loadedAssets[a].id]}
                    onChange={(newBid) => setYourBid({ ...yourBid, [loadedAssets[a].id]: newBid })}
                    style={{ flexGrow: 1 }}
                  />
                </div>
                <Button
                  style={{ marginTop: '7px', marginBottom: '20px' }}
                  onClick={() => placeBid(loadedAssets[a], yourBid[loadedAssets[a].id])}
                  disabled={!yourBid[loadedAssets[a].id] || isEnded}>
                  {/* {isBidderIncluded(bidsInfo) ? 'You already made a bid' : 'Place a bid'} */}
                  Place a bid
                </Button>
              </div>
            ) : (
              <b>You are selling this item</b>
            )}
            {loadedAssets[a].auctionInfo.isActive && (
              <div>
                {Object.entries(bidsInfo).map(([_, bidInfo]) => {
                  // console.log('bidInfo ', bidInfo);
                  return (
                    <div style={{ marginBottom: '20px' }}>
                      Bid by:{' '}
                      <Address
                        address={bidInfo.bidder}
                        ensProvider={props.scaffoldAppProviders.mainnetAdaptor?.provider}
                        blockExplorer={props.scaffoldAppProviders.targetNetwork.blockExplorer}
                        minimized={true}
                      />
                      <p style={{ margin: 0 }}>{formatEther(bidInfo.amount)} ETH</p>
                      {/* {address === loadedAssets[a].auctionInfo.seller && (
                        <Button disabled={!isEnded} onClick={() => completeAuction(loadedAssets[a], bidInfo)}>
                          Pick as a winner
                        </Button>
                      )} */}
                    </div>
                  );
                })}
              </div>
            )}
            {/* <div>
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
            </div> */}
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
        {loadedAssets[a].forSale == true && (
          <div style={{ opacity: 0.77 }}>Price: {ethers.utils.formatEther(loadedAssets[a].price)} ETH</div>
        )}
        {auctionDetails}
      </Card>
    );
  }
  const handleOk = async () => {
    setModalAuctionVisible(false);
    const { price, duration } = auctionDetails;
    const tokenId = await yourNFT?.uriToTokenId(utils.id(auctionToken));

    const auctionAddress = yourAution?.address;
    const nftAddress = yourNFT?.address;
    if (auctionAddress && tokenId) await yourNFT?.approve(auctionAddress, tokenId);

    const ethPrice = utils.parseEther(price.toString());
    const blockDuration = Math.floor(new Date().getTime() / 1000) + duration;

    if (tx && nftAddress && tokenId)
      await tx(yourAution?.createTokenAuction(nftAddress, tokenId, ethPrice, blockDuration));

    if (nftAddress && tokenId) {
      const auctionInfo = await yourAution?.getTokenAuctionDetails(nftAddress, tokenId);
      console.log('auctionInfo', { auctionInfo });
    }
  };
  const handleOKSale = async () => {
    setModalSaleVisible(false);
    console.log('sale details ', saleDetail);

    if (saleDetail.tokenUri && saleDetail.price && yourNFT) {
      const tokenId = await yourNFT.uriToTokenId(ethers.utils.id(saleDetail.tokenUri));

      //await yourNFT.approve(yourNFT.address, tokenId);
      const percentListPrice = await yourNFT.getPercentListPrice();
      if (tx) {
        const price = ethers.utils.parseEther(saleDetail.price.toString());
        const listingPrice = price.mul(percentListPrice).div(100);

        await tx(yourNFT.saleItem(saleDetail.tokenUri, price, { value: listingPrice }));

        const saleDetails = await yourNFT.forSale(ethers.utils.id(saleDetail.tokenUri));
        console.log('saleDetails ', saleDetails);
      }
    }
  };
  const handleCancel = () => {
    setModalAuctionVisible(false);
  };

  const handleCancelSale = () => {
    setModalSaleVisible(false);
  };
  return (
    <div style={{ maxWidth: 820, margin: 'auto', marginTop: 32, paddingBottom: 256 }}>
      <Button disabled={galleryList.length === 0} onClick={updateYourCollectibles} style={{ marginBottom: '25px' }}>
        Update collectibles
      </Button>
      {stakedEth && (
        <p>
          Total ETH staked: <b>{formatEther(stakedEth)}</b>
        </p>
      )}
      <StackGrid columnWidth={200} gutterWidth={16} gutterHeight={16}>
        {galleryList}
      </StackGrid>
      <Modal
        title="Start auction"
        visible={modalAuctionVisible}
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
      <Modal
        title="Start sale"
        visible={modalSaleVisible}
        onOk={handleOKSale}
        onCancel={handleCancelSale}
        okButtonProps={{ disabled: !saleDetail.price }}
        okText="Start">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <p style={{ margin: 0, marginRight: '15px' }}>ETH price : </p>
          <InputNumber
            placeholder="0.1"
            value={saleDetail.price}
            onChange={(newPrice) => setSaleDetail({ ...saleDetail, price: newPrice })}
            style={{ flexGrow: 1 }}
          />
        </div>
      </Modal>
    </div>
  );
};

export default GalleryLoadUI;
