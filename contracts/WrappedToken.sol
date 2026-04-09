// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title WrappedToken
/// @notice wUSDC / wUSDT on Bittensor EVM — minted/burned by BridgeGateway
contract WrappedToken is ERC20, Ownable {
    address public gateway;
    uint8 private immutable _dec;

    event GatewayUpdated(address indexed gateway);

    modifier onlyGateway() {
        require(msg.sender == gateway, "WrappedToken: not gateway");
        _;
    }

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_,
        address _gateway
    ) ERC20(name, symbol) Ownable(msg.sender) {
        _dec = decimals_;
        gateway = _gateway;
    }

    function decimals() public view override returns (uint8) {
        return _dec;
    }

    function setGateway(address _gateway) external onlyOwner {
        require(_gateway != address(0), "WrappedToken: zero address");
        gateway = _gateway;
        emit GatewayUpdated(_gateway);
    }

    function mint(address to, uint256 amount) external onlyGateway {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyGateway {
        _burn(from, amount);
    }
}
