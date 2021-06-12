// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IFridge {
    function setPoolId(uint256 pid) external;
    function chefInfo(address chef) external view returns (uint256, uint256);
}
