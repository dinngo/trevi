// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./FountainPermit.sol";
import "./ERC20FlashLoan.sol";

contract Fountain is FountainPermit, ERC20FlashLoan {
    modifier onlyArchangel {
        _requireMsg(
            _msgSender() == address(archangel),
            "general",
            "not from archangel"
        );
        _;
    }

    constructor(
        IERC20 token,
        string memory name_,
        string memory symbol_,
        uint256 flashLoanFee
    )
        public
        FountainToken(name_, symbol_)
        FountainBase(token)
        ERC20FlashLoan(token, flashLoanFee)
    {}

    function rescueERC20(IERC20 token, address to)
        external
        onlyArchangel
        returns (uint256)
    {
        uint256 amount;
        if (token == stakingToken) {
            amount = token.balanceOf(address(this)).sub(totalSupply());
        } else {
            amount = token.balanceOf(address(this));
        }
        token.safeTransfer(to, amount);

        return amount;
    }

    function setFlashLoanFee(uint256 fee) public override onlyArchangel {
        super.setFlashLoanFee(fee);
    }
}
