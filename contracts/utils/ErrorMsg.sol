// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

abstract contract ErrorMsg {
    function _requireMsg(
        bool condition,
        string memory functionName,
        string memory reason
    ) internal pure {
        if (!condition) _revertMsg(functionName, reason);
    }

    function _requireMsg(bool condition, string memory functionName)
        internal
        pure
    {
        if (!condition) _revertMsg(functionName);
    }

    function _revertMsg(string memory functionName, string memory reason)
        internal
        pure
    {
        revert(string(abi.encodePacked(functionName, ": ", reason)));
    }

    function _revertMsg(string memory functionName) internal pure {
        _revertMsg(functionName, "Unspecified");
    }
}
