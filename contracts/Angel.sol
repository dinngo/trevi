// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./AngelBase.sol";
import "./ERC20FlashLoan.sol";

contract Angel is AngelBase, ERC20FlashLoan {
    constructor(IERC20 token) public AngelBase(token) ERC20FlashLoan(token) {}

    function feeCollector() public view override returns (address) {
        return address(archangel);
    }
}
