pragma solidity >=0.8.0 <0.9.0;

//SPDX-License-Identifier: MIT
import "hardhat/console.sol";
import "./YourNFT.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract MarketPlaceNFT is Ownable, IERC721Receiver {
  YourNFT internal yourNFT;
  using Counters for Counters.Counter;
  Counters.Counter private _tokenIds;
  struct MarketItem {
    uint256 tokenId;
    bytes32 assetHash;
    uint256 price;
    bool sale;
    address payable sellerItem;
    address payable ownerItem;
    bool mint;
  }
  event SaleItemEvent(uint256 indexed tokenId, uint256 price, address seller, address owner);
  event BuyItemEvent(uint256 indexed tokenId, uint256 price, address seller, address buyer);

  mapping(bytes32 => MarketItem) public forSale;
  mapping(uint256 => MarketItem) public tokenIdToItem;
  uint256 percentListPrice = 10;

  constructor(
    bytes32[] memory assetsForSale,
    uint256[] memory prices,
    address _nftAddress
  ) {
    yourNFT = YourNFT(_nftAddress);
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
    console.log("owner tokenId ", yourNFT.ownerOf(item.tokenId));
    // approve(msg.sender, item.tokenId);
    yourNFT.transferFrom(address(this), msg.sender, item.tokenId);

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

    yourNFT.transferFrom(address(this), msg.sender, item.tokenId);
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

    yourNFT.transferFrom(msg.sender, address(this), item.tokenId);

    //transfer to owner contract NFT
    (bool isSuccess, ) = owner().call{ value: msg.value }("");
    require(isSuccess, "Transfer to owner contract is fail");
    emit SaleItemEvent(item.tokenId, price, msg.sender, address(this));
    return true;
  }

  function mintMarketItem(string memory _tokenURI) public payable returns (uint256) {
    bytes32 uriHash = keccak256(abi.encodePacked(_tokenURI));
    MarketItem storage item = forSale[uriHash];
    //make sure they are only minting something that is market "forsale"
    require(item.sale, "NOT FOR SALE");
    require(!item.mint, "NFT is minted");
    require(item.price == msg.value, "Invalid price");

    item.sale = false;

    _tokenIds.increment();
    uint256 id = _tokenIds.current();
    console.log("id", id);
    item.tokenId = id;

    item.mint = true;
    item.ownerItem = payable(msg.sender);
    item.sellerItem = payable(address(0));
    item.price = 0;

    tokenIdToItem[id] = item;

    yourNFT.mintItem(_tokenURI, id, msg.sender);

    (bool success, ) = owner().call{ value: msg.value }("");
    require(success, "Transanction to owner error");

    return id;
  }

  function getSaleFromTokenId(uint256 tokenId) public view returns (bool) {
    return tokenIdToItem[tokenId].sale;
  }

  function onERC721Received(
    address operator,
    address from,
    uint256 tokenId,
    bytes calldata data
  ) external returns (bytes4) {
    return bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"));
  }

  

  fallback() external payable {}
}
