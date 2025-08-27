// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title VirtualBalance
 * @dev Manages virtual balance system for locked and unlocked tokens
 * Tokens are held in the contract but accounted as user's balance
 */
abstract contract VirtualBalance {
    using SafeERC20 for IERC20;

    // user => token => balance
    mapping(address => mapping(address => uint256)) private actualBalance;
    
    // user => token => locked amount
    mapping(address => mapping(address => uint256)) private lockedBalance;

    // Events
    event BalanceDeposited(address indexed user, address indexed token, uint256 amount);
    event BalanceLocked(address indexed user, address indexed token, uint256 amount);
    event BalanceUnlocked(address indexed user, address indexed token, uint256 amount);
    event BalanceWithdrawn(address indexed user, address indexed token, uint256 amount);

    // Custom errors
    error InsufficientBalance();
    error InsufficientUnlockedBalance();
    error InvalidAmount();
    error InvalidToken();

    /**
     * @dev Get user's unlocked (available) balance for a token
     * @param user User address
     * @param token Token address
     * @return unlockedAmount Available balance
     */
    function getUnlockedBalance(address user, address token) public view virtual returns (uint256 unlockedAmount) {
        uint256 total = actualBalance[user][token];
        uint256 locked = lockedBalance[user][token];
        return total >= locked ? total - locked : 0;
    }

    /**
     * @dev Get user's total balance (locked + unlocked) for a token
     * @param user User address
     * @param token Token address
     * @return totalAmount Total balance
     */
    function getTotalBalance(address user, address token) public view virtual returns (uint256 totalAmount) {
        return actualBalance[user][token];
    }

    /**
     * @dev Get user's locked balance for a token
     * @param user User address
     * @param token Token address
     * @return lockedAmount Locked balance
     */
    function getLockedBalance(address user, address token) public view virtual returns (uint256 lockedAmount) {
        return lockedBalance[user][token];
    }

    /**
     * @dev Deposit tokens to the contract and credit user's balance
     * @param user User to credit
     * @param token Token address
     * @param amount Amount to deposit
     */
    function _depositBalance(address user, address token, uint256 amount) internal {
        if (amount == 0) revert InvalidAmount();
        if (token == address(0)) revert InvalidToken();

        IERC20(token).safeTransferFrom(user, address(this), amount);
        actualBalance[user][token] += amount;

        emit BalanceDeposited(user, token, amount);
    }

    /**
     * @dev Lock a portion of user's balance
     * @param user User address
     * @param token Token address
     * @param amount Amount to lock
     */
    function _lockBalance(address user, address token, uint256 amount) internal {
        if (amount == 0) revert InvalidAmount();
        
        uint256 unlocked = getUnlockedBalance(user, token);
        if (unlocked < amount) revert InsufficientUnlockedBalance();

        lockedBalance[user][token] += amount;

        emit BalanceLocked(user, token, amount);
    }

    /**
     * @dev Unlock a portion of user's locked balance
     * @param user User address
     * @param token Token address
     * @param amount Amount to unlock
     */
    function _unlockBalance(address user, address token, uint256 amount) internal {
        if (amount == 0) revert InvalidAmount();
        
        uint256 locked = lockedBalance[user][token];
        if (locked < amount) revert InsufficientBalance();

        lockedBalance[user][token] -= amount;

        emit BalanceUnlocked(user, token, amount);
    }

    /**
     * @dev Transfer tokens from user's balance to recipient
     * @param user User whose balance to debit
     * @param recipient Recipient address
     * @param token Token address
     * @param amount Amount to transfer
     * @param fromLocked Whether to transfer from locked balance
     */
    function _transferBalance(
        address user,
        address recipient,
        address token,
        uint256 amount,
        bool fromLocked
    ) internal {
        if (amount == 0) revert InvalidAmount();
        if (recipient == address(0)) revert InvalidToken();

        uint256 userBalance = actualBalance[user][token];
        if (userBalance < amount) revert InsufficientBalance();

        if (fromLocked) {
            uint256 locked = lockedBalance[user][token];
            if (locked < amount) revert InsufficientBalance();
            lockedBalance[user][token] -= amount;
        } else {
            uint256 unlocked = getUnlockedBalance(user, token);
            if (unlocked < amount) revert InsufficientUnlockedBalance();
        }

        actualBalance[user][token] -= amount;
        IERC20(token).safeTransfer(recipient, amount);
    }

    /**
     * @dev Withdraw tokens from user's unlocked balance
     * @param user User address
     * @param token Token address
     * @param amount Amount to withdraw
     */
    function _withdrawBalance(address user, address token, uint256 amount) internal {
        if (amount == 0) revert InvalidAmount();
        
        uint256 unlocked = getUnlockedBalance(user, token);
        if (unlocked < amount) revert InsufficientUnlockedBalance();

        actualBalance[user][token] -= amount;
        IERC20(token).safeTransfer(user, amount);

        emit BalanceWithdrawn(user, token, amount);
    }

    /**
     * @dev Internal function to move tokens from locked to unlocked (for settlements)
     * @param user User address
     * @param token Token address
     * @param amount Amount to release
     */
    function _releaseLockedBalance(address user, address token, uint256 amount) internal {
        if (amount == 0) return;
        
        uint256 locked = lockedBalance[user][token];
        uint256 toRelease = amount > locked ? locked : amount;
        
        if (toRelease > 0) {
            lockedBalance[user][token] -= toRelease;
            emit BalanceUnlocked(user, token, toRelease);
        }
    }

    /**
     * @dev Check if user has sufficient unlocked balance
     * @param user User address
     * @param token Token address
     * @param amount Amount to check
     * @return hasBalance True if sufficient balance
     */
    function _hasUnlockedBalance(address user, address token, uint256 amount) internal view returns (bool hasBalance) {
        return getUnlockedBalance(user, token) >= amount;
    }

    /**
     * @dev Modifier to ensure sufficient unlocked balance
     * @param user User address
     * @param token Token address
     * @param amount Required amount
     */
    modifier onlyUnlocked(address user, address token, uint256 amount) {
        if (!_hasUnlockedBalance(user, token, amount)) revert InsufficientUnlockedBalance();
        _;
    }

    /**
     * @dev Get balance summary for a user and token
     * @param user User address
     * @param token Token address
     * @return total Total balance
     * @return locked Locked balance
     * @return unlocked Available balance
     */
    function getBalanceSummary(address user, address token) external view returns (
        uint256 total,
        uint256 locked,
        uint256 unlocked
    ) {
        total = getTotalBalance(user, token);
        locked = getLockedBalance(user, token);
        unlocked = getUnlockedBalance(user, token);
    }
}
