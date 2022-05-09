pragma solidity >=0.8.0 <0.9.0;
//SPDX-License-Identifier: MIT
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "hardhat/console.sol";
import "./SignatureChecker.sol";
import "./YourNFT.sol";

contract Auction is IERC721Receiver, SignatureChecker {
  struct tokenDetails {
    address seller;
    uint128 price;
    uint256 duration;
    // uint256 maxBid;
    // address maxBidUser;
    bool isActive;
    // uint256[] bidAmounts;
    // address[] users;
    uint256 totalStakeAuction; // total stake of auction
    address[] usersStake;
  }
  // nft=>(tokenID=>tokenDetails)
  mapping(address => mapping(uint256 => tokenDetails)) public tokenToAuction;
  // nft=>(tokenID=> (address=>amount stake))
  mapping(address => mapping(uint256 => mapping(address => uint256))) public stakes;

  // total stake of user
  // address (user)=> totalStake
  mapping(address => uint256) public totalStake;

  function getStakeInfo(
    address _nft,
    uint256 _tokenId,
    address addr
  ) public view returns (uint256) {
    return stakes[_nft][_tokenId][addr];
  }

  //Seller puts the item on auction
  function createTokenAuction(
    address _nft,
    uint256 _tokenId,
    uint128 _price,
    uint256 _duration
  ) external {
    require(msg.sender != address(0), "Invalid Address");
    require(_nft != address(0), "Invalid Account");
    require(_price > 0, "price should be more than 0");
    require(_duration > 0, "Invalid duration value");

    // bool sale= YourNFT(_nft).getSaleFromTokenId(_tokenId);
    // require(!sale,"Item is sold");
    

    tokenDetails memory _auction = tokenDetails({
      seller: msg.sender,
      price: uint128(_price),
      duration: _duration,
      // maxBid: 0,
      // maxBidUser: address(0),
      isActive: true,
      totalStakeAuction: 0,
      usersStake: new address[](0)
      // bidAmounts: new uint256[](0),
      // users: new address[](0)
    });
    address owner = msg.sender;
    ERC721(_nft).safeTransferFrom(owner, address(this), _tokenId);
    tokenToAuction[_nft][_tokenId] = _auction;
  }

  /**
       Users bid for a particular nft, the max bid is compared and set if the current bid id highest
    */
  // function bid(address _nft, uint256 _tokenId) external payable {
  //   tokenDetails storage auction = tokenToAuction[_nft][_tokenId];
  //   require(msg.value >= auction.price, "bid price is less than current price");
  //   require(auction.isActive, "auction not active");
  //   require(auction.duration > block.timestamp, "Deadline already passed");
  //   if (bids[_nft][_tokenId][msg.sender] > 0) {
  //     (bool success, ) = msg.sender.call{ value: bids[_nft][_tokenId][msg.sender] }("");
  //     require(success);
  //   }
  //   bids[_nft][_tokenId][msg.sender] = msg.value;
  //   if (auction.bidAmounts.length == 0) {
  //     auction.maxBid = msg.value;
  //     auction.maxBidUser = msg.sender;
  //   } else {
  //     uint256 lastIndex = auction.bidAmounts.length - 1;
  //     require(auction.bidAmounts[lastIndex] < msg.value, "Current max bid is higher than your bid");
  //     auction.maxBid = msg.value;
  //     auction.maxBidUser = msg.sender;
  //   }
  //   auction.users.push(msg.sender);
  //   auction.bidAmounts.push(msg.value);
  // }

  /**
      Before making off-chain stakes potential bidders need to stake eth and either they will get it back when the auction ends or they can withdraw it any anytime.
    */
  function stake(address _nft, uint256 _tokenId) external payable {
    require(msg.sender != address(0), "Sender is zero address");
    tokenDetails storage auction = tokenToAuction[_nft][_tokenId];
    require(msg.value >= auction.price, "stake price  less than current price");
    require(auction.duration > block.timestamp, "Auction for this nft has ended");
    // check if user stake fist time
    if (stakes[_nft][_tokenId][msg.sender] == 0) {
      auction.usersStake.push(msg.sender);
    }
    stakes[_nft][_tokenId][msg.sender] += msg.value;
    totalStake[msg.sender] += msg.value;
    auction.totalStakeAuction += msg.value;
  }

  /**
       Called by the seller when the auction duration is over the hightest bid user get's the nft and other bidders get eth back
    */
  function executeSale(
    address _nft,
    uint256 _tokenId,
    address bidder,
    uint256 amount,
    bytes memory sig
  ) external {
    require(bidder != address(0), "bidder is zero address");
    tokenDetails storage auction = tokenToAuction[_nft][_tokenId];
    require(bidder != auction.seller, "bidder is not seller");
    require(amount <= stakes[_nft][_tokenId][bidder], "price greater than stake amount");
    require(amount >= auction.price, "price less than current price");
    require(auction.duration <= block.timestamp, "Auction hasn't ended yet");
    require(auction.seller == msg.sender, "Not a seller");
    require(auction.isActive, "Auction not active");
    auction.isActive = false;
    bytes32 messageHash = keccak256(abi.encodePacked(_tokenId, _nft, bidder, amount));
    bool isBidder = checkSignature(messageHash, sig, bidder);
    require(isBidder, "Invalid Bidder");
    //since this is individual hence okay to delete
    stakes[_nft][_tokenId][bidder]-=amount;
    totalStake[bidder] -= amount;

    ERC721(_nft).safeTransferFrom(address(this), bidder, _tokenId);
    (bool success, ) = auction.seller.call{ value: amount }("");
    require(success, "Transfer to seller not success");
  }

  function withdrawStake(address _nft, uint256 _tokenId) external {
    require(msg.sender != address(0), "sender is zero address");
    tokenDetails storage auction = tokenToAuction[_nft][_tokenId];
    require(stakes[_nft][_tokenId][msg.sender] > 0);
    require(auction.duration < block.timestamp, "Auction hasn't ended yet");
    uint256 amount = stakes[_nft][_tokenId][msg.sender];
    delete stakes[_nft][_tokenId][msg.sender];
    totalStake[msg.sender] -= amount;
    (bool success, ) = msg.sender.call{ value: amount }("");
    require(success);
  }

  /**
       Called by the seller if they want to cancel the auction for their nft so the bidders get back the locked eeth and the seller get's back the nft
    */
  function cancelAuction(address _nft, uint256 _tokenId) external {
    tokenDetails storage auction = tokenToAuction[_nft][_tokenId];
    require(auction.seller == msg.sender);
    require(auction.isActive,"Auction not active");
    auction.isActive = false;

    

    // address[] memory users = auction.usersStake;
    // for (uint256 i = 0; i < users.length; i++) {
    //   //require(stakes[_nft][_tokenId][users[i]] > 0);
    //   uint256 amount = stakes[_nft][_tokenId][users[i]];
    //   if(amount>0)
    //   {
    //     delete stakes[_nft][_tokenId][users[i]];
    //     totalStake[users[i]] -= amount;
    //     (bool success, ) = users[i].call{ value: amount }("");
    //     require(success,"Transfer to stake not success");
    //   }
      
    // }
    ERC721(_nft).safeTransferFrom(address(this), auction.seller, _tokenId);
  }

  function getTokenAuctionDetails(address _nft, uint256 _tokenId) public view returns (tokenDetails memory) {
    tokenDetails memory auction = tokenToAuction[_nft][_tokenId];
    return auction;
  }

  function getTotalBidderStake(address _bidder) external view returns (uint256) {
    return totalStake[_bidder];
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
