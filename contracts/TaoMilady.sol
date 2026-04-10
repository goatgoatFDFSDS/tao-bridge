// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TaoMilady
 * @notice 1111 NFT collection on Bittensor EVM — public mint, 0.011 TAO
 * Standalone ERC-721 (no OZ dependency)
 */
contract TaoMilady {
    // ── ERC-721 storage ───────────────────────────────────────────────────────
    string public name     = "TAO Milady";
    string public symbol   = "MILADY";

    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    // ── Collection config ─────────────────────────────────────────────────────
    uint256 public constant MAX_SUPPLY  = 1111;
    uint256 public constant MINT_PRICE  = 0.011 ether;
    uint256 public constant MAX_PER_TX  = 10;

    uint256 public  totalMinted;
    string  private _baseTokenURI;
    bool    public  mintOpen;
    address public  owner;

    // ── Events ────────────────────────────────────────────────────────────────
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner_, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner_, address indexed operator, bool approved);
    event Minted(address indexed to, uint256 fromId, uint256 quantity);

    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }

    constructor(string memory baseURI_) {
        owner         = msg.sender;
        _baseTokenURI = baseURI_;
    }

    // ── ERC-165 ───────────────────────────────────────────────────────────────
    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == 0x80ac58cd // ERC721
            || id == 0x5b5e139f // ERC721Metadata
            || id == 0x01ffc9a7; // ERC165
    }

    // ── ERC-721 view ──────────────────────────────────────────────────────────
    function balanceOf(address a) external view returns (uint256) {
        require(a != address(0), "zero address");
        return _balances[a];
    }
    function ownerOf(uint256 id) public view returns (address) {
        address o = _owners[id];
        require(o != address(0), "nonexistent token");
        return o;
    }
    function getApproved(uint256 id) external view returns (address) { return _tokenApprovals[id]; }
    function isApprovedForAll(address o, address op) external view returns (bool) { return _operatorApprovals[o][op]; }

    function tokenURI(uint256 id) external view returns (string memory) {
        require(_owners[id] != address(0), "nonexistent token");
        return string(abi.encodePacked(_baseTokenURI, _toString(id), ".json"));
    }

    // ── ERC-721 write ─────────────────────────────────────────────────────────
    function approve(address to, uint256 id) external {
        address o = ownerOf(id);
        require(msg.sender == o || _operatorApprovals[o][msg.sender], "Not authorized");
        _tokenApprovals[id] = to;
        emit Approval(o, to, id);
    }

    function setApprovalForAll(address op, bool approved) external {
        _operatorApprovals[msg.sender][op] = approved;
        emit ApprovalForAll(msg.sender, op, approved);
    }

    function transferFrom(address from, address to, uint256 id) public {
        require(ownerOf(id) == from, "Wrong owner");
        require(to != address(0), "Zero address");
        require(
            msg.sender == from
            || _operatorApprovals[from][msg.sender]
            || _tokenApprovals[id] == msg.sender,
            "Not authorized"
        );
        _balances[from]--;
        _balances[to]++;
        _owners[id] = to;
        delete _tokenApprovals[id];
        emit Transfer(from, to, id);
    }

    function safeTransferFrom(address from, address to, uint256 id) external {
        safeTransferFrom(from, to, id, "");
    }

    function safeTransferFrom(address from, address to, uint256 id, bytes memory data) public {
        transferFrom(from, to, id);
        if (to.code.length > 0) {
            try IERC721Receiver(to).onERC721Received(msg.sender, from, id, data) returns (bytes4 r) {
                require(r == IERC721Receiver.onERC721Received.selector, "Unsafe receiver");
            } catch { revert("Unsafe receiver"); }
        }
    }

    // ── Mint ──────────────────────────────────────────────────────────────────
    function mint(uint256 quantity) external payable {
        require(mintOpen,                               "Mint not open");
        require(quantity > 0 && quantity <= MAX_PER_TX, "Invalid quantity");
        require(totalMinted + quantity <= MAX_SUPPLY,   "Exceeds max supply");
        require(msg.value == MINT_PRICE * quantity,     "Wrong TAO amount");

        uint256 startId = totalMinted;
        for (uint256 i = 0; i < quantity; i++) {
            uint256 id = startId + i;
            _owners[id]     = msg.sender;
            _balances[msg.sender]++;
            emit Transfer(address(0), msg.sender, id);
        }
        totalMinted += quantity;
        emit Minted(msg.sender, startId, quantity);
    }

    // ── Owner ─────────────────────────────────────────────────────────────────
    function setMintOpen(bool open) external onlyOwner { mintOpen = open; }

    function setBaseURI(string calldata uri) external onlyOwner { _baseTokenURI = uri; }

    function reserve(address to, uint256 quantity) external onlyOwner {
        require(totalMinted + quantity <= MAX_SUPPLY, "Exceeds max supply");
        uint256 startId = totalMinted;
        for (uint256 i = 0; i < quantity; i++) {
            uint256 id = startId + i;
            _owners[id] = to;
            _balances[to]++;
            emit Transfer(address(0), to, id);
        }
        totalMinted += quantity;
    }

    function withdraw() external onlyOwner {
        (bool ok,) = owner.call{value: address(this).balance}("");
        require(ok, "Withdraw failed");
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }

    // ── View helpers ──────────────────────────────────────────────────────────
    function availableSupply() external view returns (uint256) {
        return MAX_SUPPLY - totalMinted;
    }

    // ── Internal ──────────────────────────────────────────────────────────────
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buf = new bytes(digits);
        while (value != 0) { digits--; buf[digits] = bytes1(uint8(48 + value % 10)); value /= 10; }
        return string(buf);
    }
}

interface IERC721Receiver {
    function onERC721Received(address, address, uint256, bytes calldata) external returns (bytes4);
}
