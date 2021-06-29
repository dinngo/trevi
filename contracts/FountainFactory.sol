// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./Fountain.sol";
import "./interfaces/IManager.sol";
import "./interfaces/IFountainFactory.sol";

/// @title The factory of Fountain
contract FountainFactory {
    IManager public immutable manager;
    /// @dev Token and Fountain should be 1-1 and only
    mapping(IERC20 => Fountain) private _fountains;

    event Created(address to);

    constructor() public {
        manager = IManager(msg.sender);
    }

    // Getters
    function isValid(Fountain fountain) external view returns (bool) {
        IERC20 token = fountain.stakingToken();

        return (_fountains[token] == fountain);
    }

    function fountainOf(IERC20 token) external view returns (Fountain) {
        return _fountains[token];
    }

    /// @notice Create Fountain for token.
    function create(ERC20 token) external returns (Fountain) {
        require(address(_fountains[token]) == address(0), "fountain existed");
        string memory name = _concat("Fountain ", token.name());
        string memory symbol = _concat("FTN-", token.symbol());
        Fountain fountain = new Fountain(token, name, symbol);
        _fountains[token] = fountain;

        emit Created(address(fountain));
    }

    function _concat(string memory a, string memory b)
        internal
        pure
        returns (string memory)
    {
        return string(abi.encodePacked(a, b));
    }
}
