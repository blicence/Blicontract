// SPDX-License-Identifier: MIT
pragma solidity >= 0.8.4;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ApiStreamBaseFlow
 * @dev Custom streaming system implementation replacing Superfluid
 * @notice Handles streaming callbacks and payment flows for our system
 */
abstract contract ApiStreamBaseFlow {
    
    bytes32 public constant STREAM_TYPE = keccak256("blicontract.streaming.v1");

    /// @dev Thrown when the callback caller is not authorized
    error UnauthorizedCaller();

    /// @dev Thrown if a required callback wasn't implemented
    error NotImplemented();

    /// @dev Thrown when tokens not accepted by the system are used
    error NotAcceptedToken();

    /**
     * @dev Initializes the streaming system
     */
    function initializeStreaming(
        bool activateOnCreated,
        bool activateOnUpdated,
        bool activateOnDeleted
    ) external {
        // Initialize our custom streaming callbacks
        _setupCallbacks(activateOnCreated, activateOnUpdated, activateOnDeleted);
    }

    /**
     * @dev Setup streaming callbacks
     */
    function _setupCallbacks(
        bool activateOnCreated,
        bool activateOnUpdated, 
        bool activateOnDeleted
    ) internal virtual {
        // Custom callback setup logic
    }

    /**
     * @dev Filter for accepting specific tokens in streams
     */
    function isAcceptedToken(address /* token */) public view virtual returns (bool) {
        return true; // Accept all tokens by default
    }

    // ---------------------------------------------------------------------------------------------
    // Stream specific callbacks to be overridden by inheriting contracts

    /// @dev Override if custom logic needed when a new stream is created
    function onStreamCreated(
        address /* token */,
        address /* sender */,
        uint256 /* amount */,
        uint256 /* duration */
    ) internal virtual returns (bool) {
        return true;
    }

    /// @dev Override if custom logic needed when a stream is updated
    function onStreamUpdated(
        address /* token */,
        address /* sender */,
        uint256 /* newAmount */,
        uint256 /* newDuration */,
        uint256 /* previousAmount */
    ) internal virtual returns (bool) {
        return true;
    }

    /// @dev Override if custom logic needed when a stream is deleted
    function onStreamDeleted(
        address /* token */,
        address /* sender */,
        address /* receiver */,
        uint256 /* previousAmount */,
        uint256 /* remainingAmount */
    ) internal virtual returns (bool) {
        return true;
    }

    // ---------------------------------------------------------------------------------------------
    // Public callback functions (called by StreamLockManager)

    function streamCreatedCallback(
        address token,
        address sender,
        uint256 amount,
        uint256 duration
    ) external returns (bool) {
        if (!isAcceptedToken(token)) revert NotAcceptedToken();
        
        return onStreamCreated(token, sender, amount, duration);
    }

    function streamUpdatedCallback(
        address token,
        address sender,
        uint256 newAmount,
        uint256 newDuration,
        uint256 previousAmount
    ) external returns (bool) {
        if (!isAcceptedToken(token)) revert NotAcceptedToken();
        
        return onStreamUpdated(token, sender, newAmount, newDuration, previousAmount);
    }

    function streamDeletedCallback(
        address token,
        address sender,
        address receiver,
        uint256 previousAmount,
        uint256 remainingAmount
    ) external returns (bool) {
        if (!isAcceptedToken(token)) revert NotAcceptedToken();
        
        return onStreamDeleted(token, sender, receiver, previousAmount, remainingAmount);
    }
}
