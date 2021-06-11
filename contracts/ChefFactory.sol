// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./MiniChefV2.sol";

contract ChefFactory {
    using BoringERC20 for IERC20;
    using BoringMath for uint256;

    mapping(MiniChefV2 => IERC20) private _chefList;
    mapping(IERC20 => mapping(address => uint256)) private _balances;
    mapping(IERC20 => mapping(address => MiniChefV2[])) private _joinChefs;
    mapping(IERC20 => mapping(MiniChefV2 => uint256)) private _chefPoolIds;

    modifier onlyChefOwner(MiniChefV2 miniChef) {
        require(MiniChefV2(miniChef).owner() == msg.sender);
        _;
    }

    // Lobby
    function createChef(IERC20 reward) external {
        MiniChefV2 newChef = new MiniChefV2(reward);
        // bypass loc 0 at miniChef
        newChef.add(0, IERC20(address(0)), IRewarder(address(0)));
        newChef.transferOwnership(msg.sender, true, false);
        _chefList[newChef] = reward;
    }

    // Kitchen
    function addMenu(
        MiniChefV2 miniChef,
        IERC20 lpToken,
        uint256 pid
    ) external onlyChefOwner(miniChef) {
        require(miniChef.lpToken(pid) == lpToken);
        _chefPoolIds[lpToken][miniChef] = pid;
    }

    function removeMenu(MiniChefV2 miniChef, IERC20 lpToken)
        external
        onlyChefOwner(miniChef)
    {
        _chefPoolIds[lpToken][miniChef] = 0;
    }

    // Customer
    function deposit(IERC20 token, uint256 amount) external {
        uint256 balance = _balances[token][msg.sender];
        token.safeTransferFrom(msg.sender, address(this), amount);
        _balances[token][msg.sender] = balance.add(amount);
    }

    // TODO: permit version

    function withdraw(IERC20 token, uint256 amount) external {
        uint256 balance = _balances[token][msg.sender];
        require(balance >= amount);
        token.safeTransfer(msg.sender, amount);
        _balances[token][msg.sender] = balance - amount;
        return;
    }

    function join(IERC20 token, MiniChefV2 chef) external {
        MiniChefV2[] storage chefs = _joinChefs[token][msg.sender];
        for (uint256 i = 0; i < chefs.length; i++) {
            require(chefs[i] != chef);
        }
        chefs.push(chef);
    }

    function quit(IERC20 token, MiniChefV2 chef) external {
        MiniChefV2[] storage chefs = _joinChefs[token][msg.sender];
        MiniChefV2[] memory temp = chefs;
        delete _joinChefs[token][msg.sender];
        for (uint256 i = 0; i < temp.length; i++) {
            if (temp[i] != chef) chefs.push(temp[i]);
        }
        require(chefs.length != temp.length);
    }
}
