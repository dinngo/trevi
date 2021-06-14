// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./Fridge.sol";
import "./interfaces/IManager.sol";
import "./interfaces/IFridgeFactory.sol";

/// @title The factory of Fridge
contract FridgeFactory {
    IManager public immutable manager;
    /// @dev Token and Fridge should be 1-1 and only
    mapping(IERC20 => Fridge) private _fridges;

    constructor() public {
        manager = IManager(msg.sender);
    }

    // Getters
    function isValid(Fridge fridge) external view returns (bool) {
        IERC20 token = fridge.stakingToken();

        return (_fridges[token] == fridge);
    }

    function fridgeOf(IERC20 token) external view returns (Fridge) {
        return _fridges[token];
    }

    /// @notice Create Fridge for token.
    function create(ERC20 token) external returns (Fridge) {
        require(address(_fridges[token]) == address(0), "fridge existed");
        string memory name = _concat("Fridged ", token.name());
        string memory symbol = _concat("FRG-", token.symbol());
        Fridge fridge = new Fridge(token, name, symbol);
        _fridges[token] = fridge;
    }

    function _concat(string memory a, string memory b)
        internal
        pure
        returns (string memory)
    {
        return string(abi.encodePacked(a, b));
    }
}
