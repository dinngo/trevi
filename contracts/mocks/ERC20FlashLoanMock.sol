// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../ERC20FlashLoan.sol";

contract ERC20FlashLoanMock is ERC20FlashLoan {
    address public collector;

    constructor(IERC20 token, bool setCollector) public ERC20FlashLoan(token) {
        if (setCollector) {
            collector = msg.sender;
        } else {
            collector = address(0);
        }
    }

    function feeCollector() public view override returns (address) {
        return collector;
    }

    function flashFee(address token, uint256 amount)
        public
        view
        override
        returns (uint256)
    {
        require(token == address(lendingToken), "ERC20FlashLoan: wrong token");
        return (amount / 100);
    }
}
