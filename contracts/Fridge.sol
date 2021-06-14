// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./libraries/ERC20Permit.sol";
import "./libraries/SafeERC20.sol";
import "./libraries/SafeMath.sol";
import "./interfaces/IMiniChefV2.sol";
import "./interfaces/IFridge.sol";

// TODO: delegate executions
/// @title Staking vault of lpTokens
contract Fridge is ERC20Permit {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    /// @notice The staking token of this Fridge
    IERC20 public immutable stakingToken;

    /// @notice The information of chef that is cached in Fridge
    struct ChefInfo {
        uint256 pid;
        uint256 totalBalance;
    }

    /// @dev The chefs that user joined
    mapping(address => IMiniChefV2[]) private _joinChefs;
    /// @dev The information of chefs
    mapping(IMiniChefV2 => ChefInfo) private _chefInfos;

    constructor(
        IERC20 token,
        string memory name_,
        string memory symbol_
    ) public ERC20(name_, symbol_) ERC20Permit(name_) {
        stakingToken = token;
    }

    // Getters
    function joinedChef(address user)
        external
        view
        returns (IMiniChefV2[] memory)
    {
        return _joinChefs[user];
    }

    function chefInfo(IMiniChefV2 chef)
        external
        view
        returns (uint256, uint256)
    {
        return (_chefInfos[chef].pid, _chefInfos[chef].totalBalance);
    }

    // Chef action
    /// @notice Chef may set their own pid that matches the staking token
    /// of the Fridge.
    function setPoolId(uint256 pid) external {
        IMiniChefV2 chef = IMiniChefV2(msg.sender);
        require(_chefInfos[chef].pid == 0, "Pid is set");
        require(
            chef.lpToken(pid) == address(stakingToken),
            "Token not matched"
        );
        _chefInfos[chef].pid = pid;
        _chefInfos[chef].totalBalance = 0;
    }

    // User action
    /// @notice User may deposit their lp token. FRG token will be minted.
    /// Fridge will call chef's deposit to update user information, but the tokens
    /// stay in Fridge.
    function deposit(uint256 amount) external {
        // Mint token
        _mint(msg.sender, amount);

        // Transfer user staking token
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        // Call joined chef
        IMiniChefV2[] storage chefs = _joinChefs[msg.sender];
        for (uint256 i = 0; i < chefs.length; i++) {
            IMiniChefV2 chef = chefs[i];
            _depositChef(chef, amount);
        }
    }

    // TODO: permit version
    /// @notice User may withdraw their lp token. FRG token will be burned.
    /// Fridge will call chef's withdraw to update user information, but the tokens
    /// will be transferred from Fridge.
    function withdraw(uint256 amount) external {
        // Burn token
        _burn(msg.sender, amount);

        // Transfer user staking token
        stakingToken.safeTransfer(msg.sender, amount);

        // Call joined chef
        IMiniChefV2[] storage chefs = _joinChefs[msg.sender];
        for (uint256 i = 0; i < chefs.length; i++) {
            IMiniChefV2 chef = chefs[i];
            _withdrawChef(chef, amount);
        }
    }

    /// @notice User may harvest from any chef.
    function harvest(IMiniChefV2 chef) external {
        // TODO: Should verify is the chef is valid
        // Call chef
        uint256 pid = _chefInfos[chef].pid;
        chef.harvest(pid, msg.sender);
    }

    /// @notice User may harvest from all the joined chefs.
    function harvestAll() external {
        // Call joined chef
        IMiniChefV2[] storage chefs = _joinChefs[msg.sender];
        for (uint256 i = 0; i < chefs.length; i++) {
            IMiniChefV2 chef = chefs[i];
            uint256 pid = _chefInfos[chef].pid;
            chef.harvest(pid, msg.sender);
        }
    }

    /// @notice Emergency withdraw all tokens.
    function emergencyWithdraw() external {
        uint256 amount = balanceOf(msg.sender);
        // Burn token
        _burn(msg.sender, amount);

        // Transfer user staking token
        stakingToken.safeTransfer(msg.sender, amount);

        // Call joined chef
        IMiniChefV2[] storage chefs = _joinChefs[msg.sender];
        for (uint256 i = 0; i < chefs.length; i++) {
            IMiniChefV2 chef = chefs[i];
            _emergencyWithdrawChef(chef);
        }
    }

    /// @notice Join the given chef's program.
    function joinChef(IMiniChefV2 chef) external {
        // TODO: Should verify if the chef is valid
        IMiniChefV2[] storage chefs = _joinChefs[msg.sender];
        for (uint256 i = 0; i < chefs.length; i++) {
            require(chefs[i] != chef);
        }
        chefs.push(chef);

        // Update user info at chef
        _depositChef(chef, balanceOf(msg.sender));
    }

    /// @notice Quit the given chef's program.
    function quitChef(IMiniChefV2 chef) external {
        // TODO: Should verify if the chef is valid
        IMiniChefV2[] storage chefs = _joinChefs[msg.sender];
        IMiniChefV2[] memory temp = chefs;
        delete _joinChefs[msg.sender];
        for (uint256 i = 0; i < temp.length; i++) {
            if (temp[i] != chef) chefs.push(temp[i]);
        }
        require(chefs.length != temp.length);

        // Update user info at chef
        _withdrawChef(chef, balanceOf(msg.sender));
    }

    /// @notice Harvest for the sender and receiver when token amount changes.
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256
    ) internal override {
        // TODO: Add more conditions to avoid unnecessary harvests.
        if (from != address(0)) {
            IMiniChefV2[] storage chefs = _joinChefs[from];
            for (uint256 i = 0; i < chefs.length; i++) {
                IMiniChefV2 chef = chefs[i];
                uint256 pid = _chefInfos[chef].pid;
                chef.harvest(pid, from);
            }
        }
        if (to != address(0)) {
            IMiniChefV2[] storage chefs = _joinChefs[to];
            for (uint256 i = 0; i < chefs.length; i++) {
                IMiniChefV2 chef = chefs[i];
                uint256 pid = _chefInfos[chef].pid;
                chef.harvest(pid, to);
            }
        }
    }

    /// @notice The total staked amount should be updated in chefInfo when
    /// token is being deposited/withdrawn.
    function _depositChef(IMiniChefV2 chef, uint256 amount) internal {
        uint256 pid = _chefInfos[chef].pid;
        _chefInfos[chef].totalBalance = _chefInfos[chef].totalBalance.add(
            amount
        );
        chef.deposit(pid, amount, msg.sender);
    }

    function _withdrawChef(IMiniChefV2 chef, uint256 amount) internal {
        uint256 pid = _chefInfos[chef].pid;
        _chefInfos[chef].totalBalance = _chefInfos[chef].totalBalance.sub(
            amount
        );
        chef.withdraw(pid, amount, msg.sender);
    }

    function _emergencyWithdrawChef(IMiniChefV2 chef) internal {
        uint256 amount = balanceOf(msg.sender);
        uint256 pid = _chefInfos[chef].pid;
        _chefInfos[chef].totalBalance = _chefInfos[chef].totalBalance.sub(
            amount
        );
        chef.emergencyWithdraw(pid, msg.sender);
    }
}
