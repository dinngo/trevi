// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./libraries/SafeERC20.sol";
import "./libraries/SafeMath.sol";
import "./interfaces/IAngel.sol";
import "./interfaces/IFountain.sol";
import "./FountainToken.sol";

// TODO: delegate executions
/// @title Staking vault of lpTokens
contract Fountain is FountainToken {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    /// @notice The staking token of this Fountain
    IERC20 public immutable stakingToken;

    /// @notice The information of angel that is cached in Fountain
    struct AngelInfo {
        uint256 pid;
        uint256 totalBalance;
    }

    /// @dev The angels that user joined
    mapping(address => IAngel[]) private _joinAngels;
    /// @dev The information of angels
    mapping(IAngel => AngelInfo) private _angelInfos;

    event Joined(address user, address angel);
    event Quitted(address user, address angel);

    constructor(
        IERC20 token,
        string memory name_,
        string memory symbol_
    ) public FountainToken(name_, symbol_) {
        stakingToken = token;
    }

    // Getters
    function joinedAngel(address user) external view returns (IAngel[] memory) {
        return _joinAngels[user];
    }

    function angelInfo(IAngel angel) external view returns (uint256, uint256) {
        return (_angelInfos[angel].pid, _angelInfos[angel].totalBalance);
    }

    // Angel action
    /// @notice Angel may set their own pid that matches the staking token
    /// of the Fountain.
    function setPoolId(uint256 pid) external {
        IAngel angel = IAngel(msg.sender);
        require(_angelInfos[angel].pid == 0, "Pid is set");
        require(
            angel.lpToken(pid) == address(stakingToken),
            "Token not matched"
        );
        _angelInfos[angel].pid = pid;
        _angelInfos[angel].totalBalance = 0;
    }

    // User action
    /// @notice User may deposit their lp token. FRG token will be minted.
    /// Fountain will call angel's deposit to update user information, but the tokens
    /// stay in Fountain.
    function deposit(uint256 amount) external {
        // Mint token
        _mint(msg.sender, amount);

        // Transfer user staking token
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
    }

    // TODO: permit version
    /// @notice User may withdraw their lp token. FRG token will be burned.
    /// Fountain will call angel's withdraw to update user information, but the tokens
    /// will be transferred from Fountain.
    function withdraw(uint256 amount) external {
        // Burn token
        _burn(msg.sender, amount);

        // Transfer user staking token
        stakingToken.safeTransfer(msg.sender, amount);
    }

    /// @notice User may harvest from any angel.
    function harvest(IAngel angel) external {
        // TODO: Should verify is the angel is valid
        // Call angel
        uint256 pid = _angelInfos[angel].pid;
        angel.harvest(pid, msg.sender);
    }

    /// @notice User may harvest from all the joined angels.
    function harvestAll() external {
        // Call joined angel
        IAngel[] storage angels = _joinAngels[msg.sender];
        for (uint256 i = 0; i < angels.length; i++) {
            IAngel angel = angels[i];
            uint256 pid = _angelInfos[angel].pid;
            angel.harvest(pid, msg.sender);
        }
    }

    /// @notice Emergency withdraw all tokens.
    function emergencyWithdraw() external {
        uint256 amount = balanceOf(msg.sender);

        // Burn token
        _burn(msg.sender, uint256(-1));

        // Transfer user staking token
        stakingToken.safeTransfer(msg.sender, amount);
    }

    /// @notice Join the given angel's program.
    function joinAngel(IAngel angel) external {
        // TODO: Should verify if the angel is valid
        IAngel[] storage angels = _joinAngels[msg.sender];
        for (uint256 i = 0; i < angels.length; i++) {
            require(angels[i] != angel);
        }
        angels.push(angel);

        emit Joined(msg.sender, address(angel));

        // Update user info at angel
        _depositAngel(msg.sender, angel, balanceOf(msg.sender));
    }

    /// @notice Quit the given angel's program.
    function quitAngel(IAngel angel) external {
        // TODO: Should verify if the angel is valid
        IAngel[] storage angels = _joinAngels[msg.sender];
        IAngel[] memory temp = angels;
        delete _joinAngels[msg.sender];
        for (uint256 i = 0; i < temp.length; i++) {
            if (temp[i] != angel) angels.push(temp[i]);
        }
        require(angels.length != temp.length);

        emit Quitted(msg.sender, address(angel));

        // Update user info at angel
        _withdrawAngel(msg.sender, angel, balanceOf(msg.sender));
    }

    /// @notice Harvest for the sender and receiver when token amount changes.
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        // TODO: Add more conditions to avoid unnecessary harvests.
        if (from != address(0)) {
            IAngel[] storage angels = _joinAngels[from];
            if (amount < type(uint256).max) {
                for (uint256 i = 0; i < angels.length; i++) {
                    IAngel angel = angels[i];
                    _withdrawAngel(from, angel, amount);
                }
            } else {
                for (uint256 i = 0; i < angels.length; i++) {
                    IAngel angel = angels[i];
                    _emergencyWithdrawAngel(from, angel);
                }
            }
        }
        if (to != address(0)) {
            IAngel[] storage angels = _joinAngels[to];
            for (uint256 i = 0; i < angels.length; i++) {
                IAngel angel = angels[i];
                _depositAngel(to, angel, amount);
            }
        }
    }

    /// @notice The total staked amount should be updated in angelInfo when
    /// token is being deposited/withdrawn.
    function _depositAngel(
        address account,
        IAngel angel,
        uint256 amount
    ) internal {
        uint256 pid = _angelInfos[angel].pid;
        require(pid != 0, "Fountain not added by angel");
        angel.deposit(pid, amount, account);
        _angelInfos[angel].totalBalance = _angelInfos[angel].totalBalance.add(
            amount
        );
    }

    function _withdrawAngel(
        address account,
        IAngel angel,
        uint256 amount
    ) internal {
        uint256 pid = _angelInfos[angel].pid;
        angel.withdraw(pid, amount, account);
        _angelInfos[angel].totalBalance = _angelInfos[angel].totalBalance.sub(
            amount
        );
    }

    function _emergencyWithdrawAngel(address account, IAngel angel) internal {
        uint256 amount = balanceOf(account);
        uint256 pid = _angelInfos[angel].pid;
        _angelInfos[angel].totalBalance = _angelInfos[angel].totalBalance.sub(
            amount
        );
        angel.emergencyWithdraw(pid, account);
    }
}
