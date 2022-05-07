pragma solidity >=0.8.0 <0.9.0;
//SPDX-License-Identifier: MIT

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

//learn more: https://docs.openzeppelin.com/contracts/3.x/erc721

// GET LISTED ON OPENSEA: https://testnets.opensea.io/get-listed/step-two

contract YourNFT is ERC721, ERC721Enumerable, ERC721URIStorage, Ownable {
  using Counters for Counters.Counter;
  Counters.Counter private _tokenIds;
  uint256 percentListPrice = 10;
  //this marks an item in IPFS as "forsale"
  mapping(bytes32 => MarketItem) public forSale;
  mapping(uint256 => MarketItem) public tokenIdToItem;
  struct MarketItem {
    uint256 tokenId;
    bytes32 assetHash;
    uint256 price;
    bool sale;
    address payable sellerItem;
    address payable ownerItem;
    bool mint;
  }
  //this lets you look up a token by the uri (assuming there is only one of each uri for now)
  mapping(bytes32 => uint256) public uriToTokenId;

  event SaleItemEvent(uint256 indexed tokenId, uint256 price, address seller, address owner);
  event BuyItemEvent(uint256 indexed tokenId, uint256 price, address seller, address buyer);

  constructor(bytes32[] memory assetsForSale, uint256[] memory prices) ERC721("YourCollectible", "YCB") {
    require(assetsForSale.length == prices.length, "Length is not same");
    for (uint256 i = 0; i < assetsForSale.length; i++) {
      forSale[assetsForSale[i]] = MarketItem({
        assetHash: assetsForSale[i],
        price: prices[i],
        sale: true,
        sellerItem: payable(address(0)),
        ownerItem: payable(address(0)),
        mint: false,
        tokenId: 0
      });
    }
  }

  function updatePercentListPrice(uint256 _percentListPrice) public {
    require(msg.sender == owner(), "Only marketplace owner can update percent listing price");
    percentListPrice = _percentListPrice;
  }

  function getPercentListPrice() public view returns (uint256) {
    return percentListPrice;
  }

  function _baseURI() internal view virtual override returns (string memory) {
    return "https://ipfs.io/ipfs/";
  }

  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 tokenId
  ) internal override(ERC721, ERC721Enumerable) {
    super._beforeTokenTransfer(from, to, tokenId);
  }

  function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
    super._burn(tokenId);
    delete tokenIdToItem[tokenId];
  }

  function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721Enumerable) returns (bool) {
    return super.supportsInterface(interfaceId);
  }

  function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
    // DO SOMETHING
    return super.tokenURI(tokenId);
  }

  function getSaleFromTokenId(uint256 tokenId) public view returns (bool) {
    return tokenIdToItem[tokenId].sale;
  }

  function buyItem(string memory tokenURI_) external payable {
    bytes32 uriHash = keccak256(abi.encodePacked(tokenURI_));
    MarketItem storage item = forSale[uriHash];
    require(msg.sender != address(0), "Sender is zero address");
    require(item.sale, "Not for sale");
    require(item.price == msg.value, "Invalid price");
    item.sale = false;
    address seller = item.sellerItem;
    item.sellerItem = payable(address(0));
    item.ownerItem = payable(msg.sender);
    (bool isSuccess, ) = seller.call{ value: msg.value }("");
    require(isSuccess, "Transaction to seller is faild");
    console.log("address(this)", address(this));
    console.log("owner tokenId ", ownerOf(item.tokenId));
    // approve(msg.sender, item.tokenId);
    ERC721(address(this)).transferFrom(address(this), msg.sender, item.tokenId);

    emit BuyItemEvent(item.tokenId, msg.value, seller, msg.sender);
  }

  function cancelSaleItem(string memory _tokenURI) public {
    bytes32 uriHash = keccak256(abi.encodePacked(_tokenURI));
    MarketItem storage item = forSale[uriHash];
    require(msg.sender == item.sellerItem, "Not Seller");
    require(item.sale, "Item not sale");
    item.sale = false;
    item.sellerItem = payable(address(0));
    item.ownerItem = payable(msg.sender);
    item.price = 0;

    ERC721(address(this)).transferFrom(address(this), msg.sender, item.tokenId);
  }

  function saleItem(string memory tokenURI_, uint256 price) public payable returns (bool) {
    bytes32 uriHash = keccak256(abi.encodePacked(tokenURI_));
    MarketItem storage item = forSale[uriHash];
    require(msg.sender == item.ownerItem, "Not owner");
    require(price > 0, "Price must be at least 1 wei");
    require(!item.sale, "Item is sale");
    uint256 listPrice = (percentListPrice * price) / 100;
    require(msg.value == listPrice, "Price must be equal to listing price");

    item.sale = true;
    item.sellerItem = payable(msg.sender);
    item.ownerItem = payable(address(this));
    item.price = price;

    transferFrom(msg.sender, address(this), item.tokenId);

    //transfer to owner contract NFT
    (bool isSuccess, ) = owner().call{ value: msg.value }("");
    require(isSuccess, "Transfer to owner contract is fail");
    emit SaleItemEvent(item.tokenId, price, msg.sender, address(this));
    return true;
  }

  function mintItem(string memory tokenURI_) public payable returns (uint256) {
    bytes32 uriHash = keccak256(abi.encodePacked(tokenURI_));
    MarketItem storage item = forSale[uriHash];
    //make sure they are only minting something that is market "forsale"
    require(item.sale, "NOT FOR SALE");
    require(!item.mint, "NFT is minted");
    require(item.price == msg.value, "Invalid price");

    item.sale = false;

    _tokenIds.increment();
    uint256 id = _tokenIds.current();
    item.tokenId = id;

    (bool success, ) = owner().call{ value: msg.value }("");
    require(success, "Transanction to owner error");

    item.mint = true;
    _mint(msg.sender, id);
    _setTokenURI(id, tokenURI_);

    item.ownerItem = payable(ownerOf(id));
    item.sellerItem = payable(address(0));
    item.price = 0;

    uriToTokenId[uriHash] = id;
    tokenIdToItem[id] = item;

    return id;
  }
}
