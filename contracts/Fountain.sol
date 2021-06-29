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
    function joinedAngel(address user) public view returns (IAngel[] memory) {
        return _joinAngels[user];
    }

    function angelInfo(IAngel angel) public view returns (uint256, uint256) {
        return (_angelInfos[angel].pid, _angelInfos[angel].totalBalance);
    }

    // Angel action
    /// @notice Angel may set their own pid that matches the staking token
    /// of the Fountain.
    function setPoolId(uint256 pid) external {
        IAngel angel = IAngel(_msgSender());
        require(_angelInfos[angel].pid == 0, "Pid is set");
        require(
            angel.lpToken(pid) == address(stakingToken),
            "Token not matched"
        );
        _angelInfos[angel].pid = pid;
        _angelInfos[angel].totalBalance = 0;
    }

    // User action
    /// @notice User may deposit their lp token. FTN token will be minted.
    /// Fountain will call angel's deposit to update user information, but the tokens
    /// stay in Fountain.
    function deposit(uint256 amount) external {
        // Mint token
        _mint(_msgSender(), amount);

        // Transfer user staking token
        stakingToken.safeTransferFrom(_msgSender(), address(this), amount);
    }

    /// @notice User may withdraw their lp token. FTN token will be burned.
    /// Fountain will call angel's withdraw to update user information, but the tokens
    /// will be transferred from Fountain.
    function withdraw(uint256 amount) external {
        // Burn token
        _burn(_msgSender(), amount);

        // Transfer user staking token
        stakingToken.safeTransfer(_msgSender(), amount);
    }

    /// @notice User may harvest from any angel.
    function harvest(IAngel angel) external {
        // TODO: Should verify is the angel is valid
        _harvest(angel, _msgSender(), _msgSender());
    }

    /// @notice User may harvest from all the joined angels.
    function harvestAll() external {
        // Call joined angel
        IAngel[] storage angels = _joinAngels[_msgSender()];
        for (uint256 i = 0; i < angels.length; i++) {
            IAngel angel = angels[i];
            _harvest(angel, _msgSender(), _msgSender());
        }
    }

    /// @notice Emergency withdraw all tokens.
    function emergencyWithdraw() external {
        uint256 amount = balanceOf(_msgSender());

        // Burn token
        _burn(_msgSender(), type(uint256).max);

        // Transfer user staking token
        stakingToken.safeTransfer(_msgSender(), amount);
    }

    /// @notice Join the given angel's program.
    function joinAngel(IAngel angel) external {
        // TODO: Should verify if the angel is valid
        IAngel[] storage angels = _joinAngels[_msgSender()];
        for (uint256 i = 0; i < angels.length; i++) {
            require(angels[i] != angel);
        }
        angels.push(angel);

        emit Joined(_msgSender(), address(angel));

        // Update user info at angel
        _depositAngel(_msgSender(), angel, balanceOf(_msgSender()));
    }

    /// @notice Quit the given angel's program.
    function quitAngel(IAngel angel) external {
        // TODO: Should verify if the angel is valid
        IAngel[] storage angels = _joinAngels[_msgSender()];
        IAngel[] memory temp = angels;
        delete _joinAngels[_msgSender()];
        for (uint256 i = 0; i < temp.length; i++) {
            if (temp[i] != angel) angels.push(temp[i]);
        }
        require(angels.length != temp.length);

        emit Quitted(_msgSender(), address(angel));

        // Update user info at angel
        _withdrawAngel(_msgSender(), angel, balanceOf(_msgSender()));
    }

    /// @notice Withdraw for the sender and deposit for the receiver
    /// when token amount changes. When the amount is UINT256_MAX,
    /// trigger emergencyWithdraw instead of withdraw.
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
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

    function _harvest(
        IAngel angel,
        address from,
        address to
    ) internal {
        uint256 pid = _angelInfos[angel].pid;
        angel.harvest(pid, from, to);
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
