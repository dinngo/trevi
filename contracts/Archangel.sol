// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./interfaces/IArchangel.sol";
import "./interfaces/IFlashLender.sol";
import "./AngelFactory.sol";
import "./FountainFactory.sol";
import "./libraries/Ownable.sol";
import "./libraries/SafeERC20.sol";

/// @title Staking system manager
contract Archangel is Ownable {
    using SafeERC20 for IERC20;

    AngelFactory public immutable angelFactory;
    FountainFactory public immutable fountainFactory;
    uint256 public defaultFlashLoanFee = 100;

    constructor() public {
        angelFactory = new AngelFactory();
        fountainFactory = new FountainFactory();
    }

    function getFountain(IERC20 token) external view returns (Fountain) {
        return fountainFactory.fountainOf(token);
    }

    function rescueERC20(IERC20 token, Fountain from)
        external
        onlyOwner
        returns (uint256)
    {
        try from.rescueERC20(token, _msgSender()) returns (uint256 amount) {
            return amount;
        } catch Error(string memory reason) {
            revert(reason);
        } catch {
            uint256 amount = token.balanceOf(address(this));
            token.safeTransfer(_msgSender(), amount);
            return amount;
        }
    }

    function setDefaultFlashLoanFee(uint256 fee) external onlyOwner {
        defaultFlashLoanFee = fee;
    }

    function setFlashLoanFee(address lender, uint256 fee) external onlyOwner {
        IFlashLender(lender).setFlashLoanFee(fee);
    }
}
