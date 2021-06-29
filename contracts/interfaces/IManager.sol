// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IManager {
    function angelFactory() external view returns (address);
    function fountainFactory() external view returns (address);
    function getFountain(address token) external view returns (address);
}
