// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./interfaces/IArchangel.sol";
import "./AngelFactory.sol";
import "./FountainFactory.sol";

/// @title Staking system manager
contract Archangel {
    AngelFactory public immutable angelFactory;
    FountainFactory public immutable fountainFactory;

    constructor() public {
        angelFactory = new AngelFactory();
        fountainFactory = new FountainFactory();
    }

    function getFountain(IERC20 token) external view returns (Fountain) {
        return fountainFactory.fountainOf(token);
    }
}
