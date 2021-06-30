// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./AngelBase.sol";
import "./ERC20FlashLoan.sol";

contract Angel is AngelBase, ERC20FlashLoan {
    modifier onlyArchangel() {
        require(msg.sender == address(archangel), "Angel: not from archangel");
        _;
    }

    constructor(IERC20 token) public AngelBase(token) ERC20FlashLoan(token) {}

    function setFee(uint256 rate) public override onlyArchangel {
        super.setFee(rate);
    }

    function feeCollector() public view override returns (address) {
        return address(archangel);
    }
}
