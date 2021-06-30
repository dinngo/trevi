// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./libraries/ReentrancyGuard.sol";
import "./libraries/SafeERC20.sol";
import "./libraries/SafeMath.sol";
import "./interfaces/IArchangel.sol";
import "./interfaces/IAngel.sol";
import "./interfaces/IFountain.sol";
import "./interfaces/IFountainFactory.sol";
import "./FountainToken.sol";

// TODO: delegate executions
/// @title Staking vault of lpTokens
abstract contract FountainBase is FountainToken, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    /// @notice The staking token of this Fountain
    IERC20 public immutable stakingToken;

    IFountainFactory public immutable factory;
    IArchangel public immutable archangel;

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

    event Joined(address user, address angel);
    event Quitted(address user, address angel);

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
        archangel = IArchangel(f.archangel());
    }

    // Getters
    function joinedAngel(address user) public view returns (IAngel[] memory) {
        return _joinedAngels[user];
    }

    function angelInfo(IAngel angel) public view returns (uint256, uint256) {
        AngelInfo storage info = _angelInfos[angel];
        require(info.isSet, "Fountain: angel not set");
        return (info.pid, info.totalBalance);
    }

    // Angel action
    /// @notice Angel may set their own pid that matches the staking token
    /// of the Fountain.
    function setPoolId(uint256 pid) external {
        IAngel angel = IAngel(_msgSender());
        AngelInfo storage info = _angelInfos[angel];
        require(info.isSet == false, "Fountain: angel is set");
        require(
            angel.lpToken(pid) == address(stakingToken),
            "Fountain: token not matched"
        );
        info.isSet = true;
        info.pid = pid;
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

        emit Deposit(_msgSender(), amount, _msgSender());
    }

    // User action
    /// @notice User may deposit their lp token for others. FTN token will be minted.
    /// Fountain will call angel's deposit to update user information, but the tokens
    /// stay in Fountain.
    function depositTo(uint256 amount, address to) external {
        // Mint token
        _mint(to, amount);

        // Transfer user staking token
        stakingToken.safeTransferFrom(_msgSender(), address(this), amount);
        emit Deposit(_msgSender(), amount, to);
    }

    /// @notice User may withdraw their lp token. FTN token will be burned.
    /// Fountain will call angel's withdraw to update user information, but the tokens
    /// will be transferred from Fountain.
    function withdraw(uint256 amount) external {
        // Burn token
        _burn(_msgSender(), amount);

        // Transfer user staking token
        stakingToken.safeTransfer(_msgSender(), amount);
        emit Withdraw(_msgSender(), amount, _msgSender());
    }

    /// @notice User may harvest from any angel.
    function harvest(IAngel angel) external {
        // TODO: Should verify is the angel is valid
        _harvestAngel(angel, _msgSender(), _msgSender());
        emit Harvest(_msgSender());
    }

    /// @notice User may harvest from all the joined angels.
    function harvestAll() external {
        // Call joined angel
        IAngel[] storage angels = _joinedAngels[_msgSender()];
        for (uint256 i = 0; i < angels.length; i++) {
            IAngel angel = angels[i];
            _harvestAngel(angel, _msgSender(), _msgSender());
        }
        emit Harvest(_msgSender());
    }

    /// @notice Emergency withdraw all tokens.
    function emergencyWithdraw() external {
        uint256 amount = balanceOf(_msgSender());

        // Burn token
        _burn(_msgSender(), type(uint256).max);

        // Transfer user staking token
        stakingToken.safeTransfer(_msgSender(), amount);
        emit EmergencyWithdraw(_msgSender(), amount, _msgSender());
    }

    /// @notice Join the given angel's program.
    function joinAngel(IAngel angel) external {
        _joinAngel(angel);
    }

    /// @notice Join the given angel's program.
    function joinAngels(IAngel[] calldata angels) external {
        for (uint256 i = 0; i < angels.length; i++) {
            _joinAngel(angels[i]);
        }
    }

    /// @notice Quit the given angel's program.
    function quitAngel(IAngel angel) external {
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
        require(angels.length != len, "Fountain: unjoined angel");

        emit Quitted(_msgSender(), address(angel));

        // Update user info at angel
        _withdrawAngel(_msgSender(), angel, balanceOf(_msgSender()));
    }

    /// @notice Quit the given angel's program.
    function quitAllAngel() external {
        IAngel[] storage angels = _joinedAngels[_msgSender()];
        for (uint256 i = 0; i < angels.length; i++) {
            IAngel angel = angels[i];
            emit Quitted(_msgSender(), address(angel));
            // Update user info at angel
            _withdrawAngel(_msgSender(), angel, balanceOf(_msgSender()));
        }
        delete _joinedAngels[_msgSender()];
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
        address account,
        IAngel angel,
        uint256 amount
    ) internal nonReentrant {
        AngelInfo storage info = _angelInfos[angel];
        require(info.isSet, "Fountain: not added by angel");
        angel.deposit(info.pid, amount, account);
        info.totalBalance = info.totalBalance.add(amount);
    }

    function _withdrawAngel(
        address account,
        IAngel angel,
        uint256 amount
    ) internal nonReentrant {
        AngelInfo storage info = _angelInfos[angel];
        require(info.isSet, "Fountain: not added by angel");
        angel.withdraw(info.pid, amount, account);
        info.totalBalance = info.totalBalance.sub(amount);
    }

    function _harvestAngel(
        IAngel angel,
        address from,
        address to
    ) internal nonReentrant {
        AngelInfo storage info = _angelInfos[angel];
        require(info.isSet, "Fountain: not added by angel");
        angel.harvest(info.pid, from, to);
    }

    function _emergencyWithdrawAngel(address account, IAngel angel)
        internal
        nonReentrant
    {
        AngelInfo storage info = _angelInfos[angel];
        require(info.isSet, "Fountain: not added by angel");
        uint256 amount = balanceOf(account);
        angel.emergencyWithdraw(info.pid, account);
        info.totalBalance = info.totalBalance.sub(amount);
    }

    function _joinAngel(IAngel angel) internal {
        IAngel[] storage angels = _joinedAngels[_msgSender()];
        for (uint256 i = 0; i < angels.length; i++) {
            require(angels[i] != angel);
        }
        angels.push(angel);

        emit Joined(_msgSender(), address(angel));

        // Update user info at angel
        _depositAngel(_msgSender(), angel, balanceOf(_msgSender()));
    }
}
