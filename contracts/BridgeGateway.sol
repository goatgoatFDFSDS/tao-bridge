// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./WrappedToken.sol";

/// @title BridgeGateway
/// @notice Deployed on Bittensor EVM (chain 964)
/// @dev Mints wUSDC/wUSDT when relayer confirms deposit on source chain
///      Burns wUSDC/wUSDT when user bridges back, emits Withdraw for relayer
contract BridgeGateway is Ownable, ReentrancyGuard {
    address public relayer;
    uint256 public withdrawNonce;

    uint256 public constant WITHDRAW_FEE_BPS = 500; // 5% fee on bridge out

    // srcChainId => srcTokenAddress => wrappedToken on Bittensor EVM
    mapping(uint256 => mapping(address => address)) public wrappedTokens;

    // wrappedToken => destChainId => available liquidity (in wrapped token decimals = 6)
    mapping(address => mapping(uint256 => uint256)) public chainLiquidity;

    // Track processed deposit nonces: srcChainId => srcNonce => processed
    mapping(uint256 => mapping(uint256 => bool)) public processedNonces;

    event Minted(
        uint256 indexed srcChainId,
        address indexed srcToken,
        address indexed recipient,
        uint256 amount,
        uint256 srcNonce
    );

    event Withdraw(
        address indexed wrappedToken,
        address indexed sender,
        address recipient,      // recipient address on destination chain
        uint256 destChainId,
        address destToken,      // token address on destination chain
        uint256 grossAmount,    // amount user sent (before 5% fee)
        uint256 netAmount,      // amount relayer will release on destination chain
        uint256 nonce
    );

    event TokenRegistered(uint256 indexed srcChainId, address srcToken, address wrappedToken);
    event RelayerUpdated(address indexed relayer);

    modifier onlyRelayer() {
        require(msg.sender == relayer, "BridgeGateway: not relayer");
        _;
    }

    constructor(address _relayer) Ownable(msg.sender) {
        relayer = _relayer;
    }

    function setRelayer(address _relayer) external onlyOwner {
        require(_relayer != address(0), "BridgeGateway: zero address");
        relayer = _relayer;
        emit RelayerUpdated(_relayer);
    }

    /// @notice Register a source chain token → wrapped token mapping
    /// @param srcChainId Chain ID of the source chain (1=ETH, 8453=Base, 56=BSC)
    /// @param srcToken Token address on source chain
    /// @param wrappedToken wUSDC or wUSDT address on Bittensor EVM
    function registerToken(
        uint256 srcChainId,
        address srcToken,
        address wrappedToken
    ) external onlyOwner {
        require(wrappedToken != address(0), "BridgeGateway: zero address");
        wrappedTokens[srcChainId][srcToken] = wrappedToken;
        emit TokenRegistered(srcChainId, srcToken, wrappedToken);
    }

    /// @notice Called by relayer after detecting a Deposit event on source chain
    /// @param srcChainId Source chain ID
    /// @param srcToken Token address on source chain
    /// @param recipient Recipient on Bittensor EVM
    /// @param amount Amount in wrapped token decimals (6) — relayer normalizes BSC 18dec
    /// @param srcNonce Nonce from source chain Deposit event
    function mint(
        uint256 srcChainId,
        address srcToken,
        address recipient,
        uint256 amount,
        uint256 srcNonce
    ) external onlyRelayer nonReentrant {
        require(!processedNonces[srcChainId][srcNonce], "BridgeGateway: nonce already processed");
        processedNonces[srcChainId][srcNonce] = true;

        address wrapped = wrappedTokens[srcChainId][srcToken];
        require(wrapped != address(0), "BridgeGateway: token not registered");

        // Track liquidity per source chain (so user can bridge back to same chain)
        chainLiquidity[wrapped][srcChainId] += amount;

        WrappedToken(wrapped).mint(recipient, amount);

        emit Minted(srcChainId, srcToken, recipient, amount, srcNonce);
    }

    /// @notice User burns wrapped tokens to bridge back to a source chain
    /// @param wrappedToken wUSDC or wUSDT address
    /// @param amount Amount to bridge back (in wrapped token decimals = 6)
    /// @param destChainId Destination chain ID (1, 8453, or 56)
    /// @param destToken Token address on destination chain
    /// @param recipient Recipient address on destination chain
    function withdraw(
        address wrappedToken,
        uint256 amount,
        uint256 destChainId,
        address destToken,
        address recipient
    ) external nonReentrant {
        require(amount > 0, "BridgeGateway: amount must be > 0");
        require(recipient != address(0), "BridgeGateway: zero recipient");

        uint256 fee       = (amount * WITHDRAW_FEE_BPS) / 10_000;
        uint256 netAmount = amount - fee;

        require(
            chainLiquidity[wrappedToken][destChainId] >= netAmount,
            "BridgeGateway: insufficient liquidity on destination chain"
        );

        chainLiquidity[wrappedToken][destChainId] -= netAmount;

        // Burn full amount — fee portion is destroyed, net amount is bridged out
        WrappedToken(wrappedToken).burn(msg.sender, amount);

        emit Withdraw(
            wrappedToken,
            msg.sender,
            recipient,
            destChainId,
            destToken,
            amount,
            netAmount,
            withdrawNonce++
        );
    }

    /// @notice View available liquidity for a given wrapped token on a destination chain
    function getLiquidity(address wrappedToken, uint256 destChainId)
        external
        view
        returns (uint256)
    {
        return chainLiquidity[wrappedToken][destChainId];
    }
}
