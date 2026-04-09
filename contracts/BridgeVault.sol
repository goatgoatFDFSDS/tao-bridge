// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title BridgeVault
/// @notice Deployed on ETH / Base / BSC
///         Locks USDC/USDT on deposit, releases on relayer instruction.
///         Owner manages liquidity (deposit/withdraw at will).
///         1% fee on every user deposit, kept in vault as liquidity.
contract BridgeVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public relayer;
    uint256 public depositNonce;
    uint256 public constant FEE_BPS = 100; // 1% (100 / 10000)

    mapping(address => bool)    public supportedTokens;
    mapping(uint256 => bool)    public processedNonces;

    // Accumulated fees per token (claimable by owner)
    mapping(address => uint256) public accruedFees;

    // TAOflow Pass holders — 0% fee. Maintained by relayer (reads NFT on TAO EVM).
    mapping(address => bool)    public feeWaivers;

    event Deposit(
        address indexed token,
        address indexed sender,
        address indexed recipient,
        uint256 grossAmount,   // what the user sent
        uint256 netAmount,     // after 1% fee — relayer uses this
        uint256 nonce
    );

    event Released(address indexed token, address indexed recipient, uint256 amount, uint256 srcNonce);
    event LiquidityAdded(address indexed token, uint256 amount);
    event LiquidityRemoved(address indexed token, uint256 amount);
    event FeesClaimed(address indexed token, uint256 amount);
    event TokenUpdated(address indexed token, bool supported);
    event RelayerUpdated(address indexed relayer);
    event FeeWaiverSet(address indexed wallet, bool exempt);

    modifier onlyRelayer() {
        require(msg.sender == relayer, "BridgeVault: not relayer");
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

    function setToken(address token, bool supported) external onlyOwner {
        supportedTokens[token] = supported;
        emit TokenUpdated(token, supported);
    }

    /// @notice Grant or revoke fee waiver for a TAOflow Pass holder.
    ///         Called by relayer after verifying NFT ownership on TAO EVM.
    function setFeeWaiver(address wallet, bool exempt) external onlyRelayer {
        feeWaivers[wallet] = exempt;
        emit FeeWaiverSet(wallet, exempt);
    }

    /// @notice Batch version for initial sync.
    function setFeeWaivers(address[] calldata wallets, bool exempt) external onlyRelayer {
        for (uint256 i = 0; i < wallets.length; i++) {
            feeWaivers[wallets[i]] = exempt;
            emit FeeWaiverSet(wallets[i], exempt);
        }
    }

    /// @notice Owner deposits liquidity into the vault so releases can be honored
    function addLiquidity(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit LiquidityAdded(token, amount);
    }

    /// @notice Owner withdraws liquidity from the vault
    function removeLiquidity(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(msg.sender, amount);
        emit LiquidityRemoved(token, amount);
    }

    /// @notice Owner claims accumulated protocol fees
    function claimFees(address token) external onlyOwner {
        uint256 amount = accruedFees[token];
        require(amount > 0, "BridgeVault: no fees");
        accruedFees[token] = 0;
        IERC20(token).safeTransfer(msg.sender, amount);
        emit FeesClaimed(token, amount);
    }

    // ── User ───────────────────────────────────────────────────────────────────

    /// @notice Deposit USDC/USDT to bridge to Bittensor EVM.
    ///         1% fee is kept in vault. Relayer sends TAO based on netAmount.
    function deposit(
        address token,
        uint256 amount,
        address recipient
    ) external nonReentrant {
        require(supportedTokens[token], "BridgeVault: token not supported");
        require(amount > 0, "BridgeVault: amount must be > 0");
        require(recipient != address(0), "BridgeVault: zero recipient");

        uint256 balBefore   = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        uint256 received    = IERC20(token).balanceOf(address(this)) - balBefore;

        uint256 fee         = feeWaivers[msg.sender] ? 0 : (received * FEE_BPS) / 10_000;
        uint256 netAmount   = received - fee;

        accruedFees[token] += fee;

        emit Deposit(token, msg.sender, recipient, received, netAmount, depositNonce++);
    }

    // ── Relayer ────────────────────────────────────────────────────────────────

    /// @notice Relayer releases tokens when user bridges back from Bittensor EVM
    function release(
        address token,
        address recipient,
        uint256 amount,
        uint256 srcNonce
    ) external onlyRelayer nonReentrant {
        require(!processedNonces[srcNonce], "BridgeVault: nonce already processed");
        processedNonces[srcNonce] = true;
        IERC20(token).safeTransfer(recipient, amount);
        emit Released(token, recipient, amount, srcNonce);
    }

    // ── Views ──────────────────────────────────────────────────────────────────

    function getBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
}
