// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "./interfaces/IArchangel.sol";
import "./interfaces/IAngel.sol";
import "./interfaces/IFountain.sol";
import "./interfaces/IFountainFactory.sol";
import "./utils/ErrorMsg.sol";
import "./FountainToken.sol";

/// @title Staking vault of lpTokens
abstract contract FountainBase is FountainToken, ReentrancyGuard, ErrorMsg {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    /// @notice The staking token of this Fountain
    IERC20 public immutable stakingToken;

    IFountainFactory public immutable factory;

    /// @notice The information of angel that is cached in Fountain
    struct AngelInfo {
        bool isSet;
        uint256 pid;
        uint256 totalBalance;
    }

    /// @dev The angels that user joined
    mapping(address => IAngel[]) private _joinedAngels;
    /// @dev The information of angels
    mapping(IAngel => AngelInfo) private _angelInfos;

    event Join(address user, address angel);
    event Quit(address user, address angel);
    event RageQuit(address user, address angel);
    event Deposit(address indexed user, uint256 amount, address indexed to);
    event Withdraw(address indexed user, uint256 amount, address indexed to);
    event EmergencyWithdraw(
        address indexed user,
        uint256 amount,
        address indexed to
    );
    event Harvest(address indexed user);

    constructor(IERC20 token) public {
        stakingToken = token;
        IFountainFactory f = IFountainFactory(msg.sender);
        factory = f;
    }

    // Getters
    /// @notice Return the angels that user joined.
    /// @param user The user address.
    /// @return The angel list.
    function joinedAngel(address user) public view returns (IAngel[] memory) {
        return _joinedAngels[user];
    }

    /// @notice Return the information of the angel. The fountain needs to be
    /// added by angel.
    /// @param angel The angel to be queried.
    /// @return The pid in angel.
    /// @return The total balance deposited in angel.
    function angelInfo(IAngel angel) external view returns (uint256, uint256) {
        AngelInfo storage info = _angelInfos[angel];
        //_requireMsg(info.isSet, "angelInfo", "angel not set");
        return (info.pid, info.totalBalance);
    }

    /// Angel action
    /// @notice Angel may set their own pid that matches the staking token
    /// of the Fountain.
    /// @param pid The pid to be assigned.
    function setPoolId(uint256 pid) external {
        IAngel angel = IAngel(_msgSender());
        AngelInfo storage info = _angelInfos[angel];
        _requireMsg(!info.isSet, "setPoolId", "angel is set");
        _requireMsg(
            angel.lpToken(pid) == address(stakingToken),
            "setPoolId",
            "token not matched"
        );
        info.isSet = true;
        info.pid = pid;
    }

    // User action
    /// @notice User may deposit their lp token. FTN token will be minted.
    /// Fountain will call angel's deposit to update user information, but the tokens
    /// stay in Fountain.
    /// @param amount The amount to be deposited.
    function deposit(uint256 amount) external nonReentrant {
        // Transfer user staking token
        uint256 balance = _deposit(amount);

        // Mint token
        _mint(_msgSender(), balance);

        emit Deposit(_msgSender(), balance, _msgSender());
    }

    function _deposit(uint256 amount) internal returns (uint256) {
        uint256 balance = stakingToken.balanceOf(address(this));
        stakingToken.safeTransferFrom(_msgSender(), address(this), amount);
        balance = stakingToken.balanceOf(address(this)) - balance;

        return balance;
    }

    // User action
    /// @notice User may deposit their lp token for others. FTN token will be minted.
    /// Fountain will call angel's deposit to update user information, but the tokens
    /// stay in Fountain.
    /// @param amount The amount to be deposited.
    /// @param to The address to be deposited.
    function depositTo(uint256 amount, address to) external nonReentrant {
        // Transfer user staking token
        uint256 balance = _deposit(amount);

        // Mint token
        _mint(to, balance);

        emit Deposit(_msgSender(), balance, to);
    }

    /// @notice User may withdraw their lp token. FTN token will be burned.
    /// Fountain will call angel's withdraw to update user information, but the tokens
    /// will be transferred from Fountain.
    /// @param amount The amount to be withdrawn.
    function withdraw(uint256 amount) external nonReentrant {
        uint256 balance = _withdraw(amount, _msgSender());

        // Burn token
        _burn(_msgSender(), balance);
        emit Withdraw(_msgSender(), balance, _msgSender());
    }

    function _withdraw(uint256 amount, address to) internal returns (uint256) {
        // Withdraw entire balance if amount == UINT256_MAX
        amount = amount == type(uint256).max ? balanceOf(_msgSender()) : amount;
        uint256 balance = stakingToken.balanceOf(address(this));
        stakingToken.safeTransfer(to, amount);
        balance = balance - stakingToken.balanceOf(address(this));

        return balance;
    }

    /// @notice User may withdraw their lp token. FTN token will be burned.
    /// Fountain will call angel's withdraw to update user information, but the tokens
    /// will be transferred from Fountain.
    /// @param amount The amount to be withdrawn.
    /// @param to The address to sent the withdrawn balance to.
    function withdrawTo(uint256 amount, address to) external nonReentrant {
        uint256 balance = _withdraw(amount, to);

        // Burn token
        _burn(_msgSender(), balance);

        emit Withdraw(_msgSender(), balance, to);
    }

    /// @notice User may harvest from any angel.
    /// @param angel The angel to be harvest from.
    function harvest(IAngel angel) external nonReentrant {
        _harvestAngel(angel, _msgSender(), _msgSender());
        emit Harvest(_msgSender());
    }

    /// @notice User may harvest from all the joined angels.
    function harvestAll() external nonReentrant {
        // Call joined angel
        IAngel[] storage angels = _joinedAngels[_msgSender()];
        for (uint256 i = 0; i < angels.length; i++) {
            IAngel angel = angels[i];
            _harvestAngel(angel, _msgSender(), _msgSender());
        }
        emit Harvest(_msgSender());
    }

    /// @notice Emergency withdraw all tokens.
    function emergencyWithdraw() external nonReentrant {
        uint256 amount = balanceOf(_msgSender());
        uint256 balance = _withdraw(amount, _msgSender());

        // Burn token
        _burn(_msgSender(), type(uint256).max);

        emit EmergencyWithdraw(_msgSender(), balance, _msgSender());
    }

    /// @notice Join the given angel's program.
    /// @param angel The angel to be joined.
    function joinAngel(IAngel angel) external nonReentrant {
        _joinAngel(angel, _msgSender());
    }

    /// @notice Join the given angels' program.
    /// @param angels The angels to be joined.
    function joinAngels(IAngel[] calldata angels) external nonReentrant {
        for (uint256 i = 0; i < angels.length; i++) {
            _joinAngel(angels[i], _msgSender());
        }
    }

    /// @notice Quit the given angel's program.
    /// @param angel The angel to be quited.
    function quitAngel(IAngel angel) external nonReentrant {
        _quitAngel(angel);
        emit Quit(_msgSender(), address(angel));

        // Update user info at angel
        _withdrawAngel(_msgSender(), angel, balanceOf(_msgSender()));
    }

    /// @notice Quit all angels' program.
    function quitAllAngel() external nonReentrant {
        IAngel[] storage angels = _joinedAngels[_msgSender()];
        for (uint256 i = 0; i < angels.length; i++) {
            IAngel angel = angels[i];
            emit Quit(_msgSender(), address(angel));
            // Update user info at angel
            _withdrawAngel(_msgSender(), angel, balanceOf(_msgSender()));
        }
        delete _joinedAngels[_msgSender()];
    }

    /// @notice Quit an angel's program with emergencyWithdraw
    /// @param angel The angel to be quited.
    function rageQuitAngel(IAngel angel) external nonReentrant {
        _quitAngel(angel);
        emit RageQuit(_msgSender(), address(angel));

        // Update user info at angel
        _emergencyWithdrawAngel(_msgSender(), angel);
    }

    /// @notice Apply nonReentrant to transfer.
    function transfer(address recipient, uint256 amount)
        public
        override
        nonReentrant
        returns (bool)
    {
        return super.transfer(recipient, amount);
    }

    /// @notice Apply nonReentrant to transferFrom.
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public override nonReentrant returns (bool) {
        return super.transferFrom(sender, recipient, amount);
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
            IAngel[] storage angels = _joinedAngels[from];
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
            IAngel[] storage angels = _joinedAngels[to];
            for (uint256 i = 0; i < angels.length; i++) {
                IAngel angel = angels[i];
                _depositAngel(to, angel, amount);
            }
        }
    }

    /// @notice The total staked amount should be updated in angelInfo when
    /// token is being deposited/withdrawn.
    function _depositAngel(
        address user,
        IAngel angel,
        uint256 amount
    ) internal {
        AngelInfo storage info = _angelInfos[angel];
        _requireMsg(info.isSet, "_depositAngel", "not added by angel");
        angel.deposit(info.pid, amount, user);
        info.totalBalance = info.totalBalance.add(amount);
    }

    function _withdrawAngel(
        address user,
        IAngel angel,
        uint256 amount
    ) internal {
        AngelInfo storage info = _angelInfos[angel];
        _requireMsg(info.isSet, "_withdrawAngel", "not added by angel");
        angel.withdraw(info.pid, amount, user);
        info.totalBalance = info.totalBalance.sub(amount);
    }

    function _harvestAngel(
        IAngel angel,
        address from,
        address to
    ) internal {
        AngelInfo storage info = _angelInfos[angel];
        _requireMsg(info.isSet, "_harvestAngel", "not added by angel");
        angel.harvest(info.pid, from, to);
    }

    function _emergencyWithdrawAngel(address user, IAngel angel) internal {
        AngelInfo storage info = _angelInfos[angel];
        _requireMsg(info.isSet, "_emergencyAngel", "not added by angel");
        uint256 amount = balanceOf(user);
        angel.emergencyWithdraw(info.pid, user);
        info.totalBalance = info.totalBalance.sub(amount);
    }

    function _joinAngel(IAngel angel, address user) internal {
        IAngel[] storage angels = _joinedAngels[user];
        for (uint256 i = 0; i < angels.length; i++) {
            _requireMsg(angels[i] != angel, "_joinAngel", "angel joined");
        }
        angels.push(angel);

        emit Join(user, address(angel));

        // Update user info at angel
        _depositAngel(user, angel, balanceOf(user));
    }

    function _quitAngel(IAngel angel) internal {
        IAngel[] storage angels = _joinedAngels[_msgSender()];
        uint256 len = angels.length;
        if (angels[len - 1] == angel) {
            angels.pop();
        } else {
            for (uint256 i = 0; i < len - 1; i++) {
                if (angels[i] == angel) {
                    angels[i] = angels[len - 1];
                    angels.pop();
                    break;
                }
            }
        }
        _requireMsg(angels.length != len, "_quitAngel", "unjoined angel");
    }
}
