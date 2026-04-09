// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract NFTMarketplace is ReentrancyGuard {
    struct Listing {
        address seller;
        uint256 price;
        bool active;
    }

    mapping(address => mapping(uint256 => Listing)) public listings;
    uint256 public feePercent = 250; // 2.5%
    address public feeRecipient;

    event Listed(address indexed nft, uint256 indexed tokenId, address seller, uint256 price);
    event Sold(address indexed nft, uint256 indexed tokenId, address buyer, uint256 price);
    event Delisted(address indexed nft, uint256 indexed tokenId);

    constructor() {
        feeRecipient = msg.sender;
    }

    function list(address nft, uint256 tokenId, uint256 price) external {
        require(price > 0, "Price must be > 0");
        IERC721(nft).transferFrom(msg.sender, address(this), tokenId);
        listings[nft][tokenId] = Listing(msg.sender, price, true);
        emit Listed(nft, tokenId, msg.sender, price);
    }

    function buy(address nft, uint256 tokenId) external payable nonReentrant {
        Listing storage l = listings[nft][tokenId];
        require(l.active, "Not listed");
        require(msg.value >= l.price, "Insufficient payment");
        l.active = false;
        uint256 fee = (l.price * feePercent) / 10000;
        payable(feeRecipient).transfer(fee);
        payable(l.seller).transfer(l.price - fee);
        IERC721(nft).transferFrom(address(this), msg.sender, tokenId);
        if (msg.value > l.price) payable(msg.sender).transfer(msg.value - l.price);
        emit Sold(nft, tokenId, msg.sender, l.price);
    }

    function delist(address nft, uint256 tokenId) external {
        Listing storage l = listings[nft][tokenId];
        require(l.seller == msg.sender, "Not seller");
        require(l.active, "Not listed");
        l.active = false;
        IERC721(nft).transferFrom(address(this), msg.sender, tokenId);
        emit Delisted(nft, tokenId);
    }

    function getListing(address nft, uint256 tokenId) external view returns (address seller, uint256 price, bool active) {
        Listing storage l = listings[nft][tokenId];
        return (l.seller, l.price, l.active);
    }
}
