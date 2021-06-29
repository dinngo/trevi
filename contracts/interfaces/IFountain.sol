// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

interface IFountain {
    function setPoolId(uint256 pid) external;
    function angelInfo(address angel) external view returns (uint256, uint256);
}
