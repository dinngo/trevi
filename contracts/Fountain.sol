// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./FountainPermit.sol";
import "./FountainFlashLoan.sol";

contract Fountain is FountainPermit, FountainFlashLoan {
    constructor(
        IERC20 token,
        string memory name_,
        string memory symbol_
    ) public FountainToken(name_, symbol_) FountainBase(token) {}
}
