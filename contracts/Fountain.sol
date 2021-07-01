// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./FountainBase.sol";

/**
 * @dev  Implementation of the ERC20 Permit extension allowing approvals to be made via signatures, as defined in
 * https://eips.ethereum.org/EIPS/eip-2612[EIP-2612].
 *
 * Adds the {permit} method, which can be used to change an account's ERC20 allowance (see {IERC20-allowance}) by
 * presenting a message signed by the account. By not relying on `{IERC20-approve}`, the token holder account doesn't
 * need to send a transaction, and thus is not required to hold Ether at all.
 *
 * _Available since v3.4._
 */
contract Fountain is FountainBase {
    using Counters for Counters.Counter;

    mapping(address => mapping(address => uint256)) private _allowances;
    mapping(address => Counters.Counter) private _nonces;

    // solhint-disable-next-line var-name-mixedcase
    bytes32 private immutable _HARVEST_PERMIT_TYPEHASH =
        keccak256(
            "HarvestPermit(address owner,address sender,uint256 timeLimit,uint256 nonce,uint256 deadline)"
        );

    /**
     *  @dev Emitted when the allowance of a `sender` for an `owner` is set by
     * a call to {approve}. `timeLimit` is the new allowance.
     */
    event HarvestApproval(
        address indexed owner,
        address indexed sender,
        uint256 timeLimit
    );

    modifier canHarvestFrom(address owner) {
        require(
            block.timestamp <= _allowances[owner][_msgSender()],
            "Fountain: harvest not allowed"
        );
        _;
    }

    constructor(
        IERC20 token,
        string memory name_,
        string memory symbol_
    ) public FountainBase(token, name_, symbol_) {}

    function harvestAllowance(address owner, address sender)
        public
        view
        returns (uint256)
    {
        return _allowances[owner][sender];
    }

    /**
     * Requirements:
     *
     * - `sender` cannot be the zero address.
     */
    function harvestApprove(address sender, uint256 timeLimit)
        public
        returns (bool)
    {
        _harvestApprove(_msgSender(), sender, timeLimit);
        return true;
    }

    function harvestPermit(
        address owner,
        address sender,
        uint256 timeLimit,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        // solhint-disable-next-line not-rely-on-time
        require(block.timestamp <= deadline, "Fountain: expired deadline");

        bytes32 structHash =
            keccak256(
                abi.encode(
                    _HARVEST_PERMIT_TYPEHASH,
                    owner,
                    sender,
                    timeLimit,
                    _nonces[owner].current(),
                    deadline
                )
            );

        bytes32 hash = _hashTypedDataV4(structHash);

        address signer = ECDSA.recover(hash, v, r, s);
        require(signer == owner, "Fountain: invalid signature");

        _nonces[owner].increment();
        _harvestApprove(owner, sender, timeLimit);
    }

    function harvestNonces(address owner) public view returns (uint256) {
        return _nonces[owner].current();
    }

    /// @notice User may harvest from any angel for permitted user
    function harvestFrom(
        IAngel angel,
        address from,
        address to
    ) public canHarvestFrom(from) {
        _harvestAngel(angel, from, to);
        emit Harvest(from);
    }

    /// @notice User may harvest from all the joined angels of permitted user
    function harvestAllFrom(address from, address to)
        public
        canHarvestFrom(from)
    {
        IAngel[] memory angels = joinedAngel(from);
        for (uint256 i = 0; i < angels.length; i++) {
            IAngel angel = angels[i];
            _harvestAngel(angel, from, to);
        }
        emit Harvest(from);
    }

    function harvestFromWithPermit(
        IAngel angel,
        address from,
        address to,
        uint256 timeLimit,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        harvestPermit(from, _msgSender(), timeLimit, deadline, v, r, s);
        harvestFrom(angel, from, to);
    }

    function harvestAllFromWithPermit(
        address from,
        address to,
        uint256 timeLimit,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        harvestPermit(from, _msgSender(), timeLimit, deadline, v, r, s);
        harvestAllFrom(from, to);
    }

    /**
     * @dev Sets `timeLimit` as the time allowance of `sender` over the
     * `owner` s tokens.
     *
     * This internal function is equivalent to `approve`, and can be used to
     * e.g. set automatic allowances for certain subsystems, etc.
     *
     * Emits an {HarvestApproval} event.
     *
     * Requirements:
     *
     * - `owner` cannot be the zero address.
     * - `sender` cannot be the zero address.
     */
    function _harvestApprove(
        address owner,
        address sender,
        uint256 timeLimit
    ) internal {
        require(owner != address(0), "Fountain: approve from the zero address");
        require(sender != address(0), "Fountain: approve to the zero address");

        _allowances[owner][sender] = timeLimit;
        emit HarvestApproval(owner, sender, timeLimit);
    }
}
