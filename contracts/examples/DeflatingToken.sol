// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../ERC20.sol";

contract DeflatingToken is ERC20 {
    uint256 constant FEE_RATE = 100;
    uint256 constant FEE_BASE = 10000;

    constructor(string memory name_,
               string memory symbol_,
               uint256 amount) public ERC20(name_, symbol_) {
        _mint(msg.sender, amount);
               }

    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal override {
        uint256 fee = amount * FEE_RATE / FEE_BASE;
        super._transfer(sender, address(this), fee);
        super._transfer(sender, recipient, amount - fee);
    }
}
