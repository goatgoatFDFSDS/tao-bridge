// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IPassNFT {
    function balanceOf(address owner) external view returns (uint256);
}

/// @title TaoReceiver
/// @notice Deployed on Bittensor EVM (chain 964)
///         Receives native TAO from users bridging back to stablecoins.
///         Owner manages TAO liquidity freely.
///         5% fee on every user deposit (0% for TAOflow Pass holders).
contract TaoReceiver is Ownable, ReentrancyGuard {
    address public relayer;
    uint256 public depositNonce;
    uint256 public constant FEE_BPS = 500; // 5%

    /// @notice TAOflow Pass NFT contract — holders pay 0% fee.
    address public passContract;

    uint256 public accruedFees;

    mapping(uint256 => bool) public processedNonces;

    event TaoDeposit(
        address indexed sender,
        address indexed recipient,
        uint256 destChainId,
        address destToken,
        uint256 grossAmount,  // TAO sent by user
        uint256 netAmount,    // after 1% fee — relayer uses this
        uint256 nonce
    );

    event LiquidityAdded(uint256 amount);
    event LiquidityRemoved(uint256 amount);
    event FeesClaimed(uint256 amount);
    event RelayerUpdated(address indexed relayer);
    event PassContractSet(address indexed passContract);

    modifier onlyRelayer() {
        require(msg.sender == relayer, "TaoReceiver: not relayer");
        _;
    }

    constructor(address _relayer) Ownable(msg.sender) {
        relayer = _relayer;
    }

    // ── Admin ──────────────────────────────────────────────────────────────────

    function setRelayer(address _relayer) external onlyOwner {
        require(_relayer != address(0));
        relayer = _relayer;
        emit RelayerUpdated(_relayer);
    }

    /// @notice Set the TAOflow Pass NFT contract. Set to address(0) to disable.
    function setPassContract(address _pass) external onlyOwner {
        passContract = _pass;
        emit PassContractSet(_pass);
    }

    /// @notice Owner sends TAO to this contract to fund outbound bridges
    function addLiquidity() external payable onlyOwner {
        require(msg.value > 0);
        emit LiquidityAdded(msg.value);
    }

    /// @notice Owner withdraws TAO from the contract
    function removeLiquidity(uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "TaoReceiver: insufficient balance");
        payable(owner()).transfer(amount);
        emit LiquidityRemoved(amount);
    }

    /// @notice Owner claims accumulated protocol fees
    function claimFees() external onlyOwner {
        require(accruedFees > 0, "TaoReceiver: no fees");
        uint256 amount = accruedFees;
        accruedFees = 0;
        payable(owner()).transfer(amount);
        emit FeesClaimed(amount);
    }

    // ── User ───────────────────────────────────────────────────────────────────

    /// @notice User sends TAO here to receive stablecoins on a source chain.
    ///         5% fee is kept in contract. Relayer releases stables based on netAmount.
    function depositTao(
        uint256 destChainId,
        address destToken,
        address recipient
    ) external payable nonReentrant {
        require(msg.value > 0, "TaoReceiver: send TAO");
        require(recipient != address(0), "TaoReceiver: zero recipient");

        bool hasPass = passContract != address(0) &&
                       IPassNFT(passContract).balanceOf(msg.sender) > 0;
        uint256 fee       = hasPass ? 0 : (msg.value * FEE_BPS) / 10_000;
        uint256 netAmount = msg.value - fee;

        accruedFees += fee;

        emit TaoDeposit(msg.sender, recipient, destChainId, destToken, msg.value, netAmount, depositNonce++);
    }

    // ── Relayer ────────────────────────────────────────────────────────────────

    /// @notice Relayer withdraws TAO to send to users bridging in (Stable → TAO direction)
    function relayerWithdraw(uint256 amount) external onlyRelayer {
        require(address(this).balance >= amount);
        payable(relayer).transfer(amount);
    }

    // ── Views ──────────────────────────────────────────────────────────────────

    function getTaoBalance() external view returns (uint256) {
        return address(this).balance;
    }

    receive() external payable {}
}
