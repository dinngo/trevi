// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IFountainFactory {
    function create(address token) external returns (address);
    function fountainOf(address token) external view returns (address);
    function archangel() external view returns (address);
}
