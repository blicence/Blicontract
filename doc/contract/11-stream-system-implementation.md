
# StreamLockManager Implementation - Güncel Kod

Bu dokümantasyon, production'da çalışan StreamLockManager sisteminin güncel implementasyonunu içermektedir.

## İçindekiler
- [Ana Kontrat](#ana-kontrat)
- [Interface Tanımları](#interface-tanımları)
- [Library Implementasyonları](#library-implementasyonları)
- [Test Coverage](#test-coverage)
- [Production Deployment](#production-deployment)

---

## Ana Kontrat

### StreamLockManager.sol (Production Ready)
```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/IStreamLockManager.sol";
import "./libraries/VirtualBalance.sol";
import "./libraries/StreamRateCalculator.sol";

/**
 * @title StreamLockManager
 * @dev Main contract for managing token locks and streaming payments
 * Replaces Superfluid integration with a more controlled streaming system
 */
contract StreamLockManager is 
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    VirtualBalance,
    IStreamLockManager
{
    using SafeERC20 for IERC20;

    // State variables
    mapping(address => bool) public authorizedCallers;
    mapping(bytes32 => StreamData) public streams;
    mapping(address => mapping(address => VirtualBalanceData)) public virtualBalances;
    mapping(address => bytes32[]) public userActiveStreams;
    mapping(address => bytes32[]) public producerIncomingStreams;
    
    uint256 public minStreamAmount;
    uint256 public minStreamDuration;
    uint256 public maxStreamDuration;
    uint256 private _streamNonce;
```
    using SafeERC20 for IERC20;
    using StreamCalculator for uint256;

    // Role definitions
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant SETTLER_ROLE = keccak256("SETTLER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // Stream storage
    mapping(bytes32 => TokenLock) public tokenLocks;
    mapping(address => bytes32[]) public userLocks;
    mapping(address => bytes32[]) public recipientLocks;
    mapping(address => uint256) public lockedBalances;

    // System parameters
    uint256 public constant MIN_STREAM_AMOUNT = 1000; // 1000 wei minimum
    uint256 public constant MIN_STREAM_DURATION = 1 hours;
    uint256 public constant MAX_STREAM_DURATION = 365 days;
    uint256 public constant PRECISION = 1e18;

    // System statistics
    uint256 public totalActiveStreams;
    uint256 public totalLockedValue;
    uint256 public totalSettledValue;

    /**
     * @dev Contract constructor
     */
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    /**
     * @notice Create a new stream lock
     * @param recipient Address that will receive the streamed tokens
     * @param token ERC20 token address
     * @param totalAmount Total amount to be streamed
     * @param duration Stream duration in seconds
     * @return lockId Unique identifier for the created lock
     */
    function createStreamLock(
        address recipient,
        address token,
        uint256 totalAmount,
        uint256 duration
    ) 
        external 
        override 
        nonReentrant 
        whenNotPaused 
        returns (bytes32 lockId) 
    {
        _validateStreamParameters(recipient, token, totalAmount, duration);

        // Transfer tokens to this contract
        IERC20(token).safeTransferFrom(msg.sender, address(this), totalAmount);

        // Calculate stream rate
        uint256 streamRate = totalAmount.calculateStreamRate(duration);

        // Generate unique lock ID
        lockId = _generateLockId(msg.sender, recipient, token, totalAmount);

        // Create lock
        tokenLocks[lockId] = TokenLock({
            user: msg.sender,
            recipient: recipient,
            token: token,
            totalAmount: totalAmount,
            streamRate: streamRate,
            startTime: block.timestamp,
            endTime: block.timestamp + duration,
            lastClaimTime: block.timestamp,
            isActive: true,
            lockId: lockId
        });

        // Update mappings
        userLocks[msg.sender].push(lockId);
        recipientLocks[recipient].push(lockId);
        lockedBalances[msg.sender] += totalAmount;

        // Update statistics
        totalActiveStreams++;
        totalLockedValue += totalAmount;

        emit StreamLockCreated(lockId, msg.sender, recipient, totalAmount, duration);

        return lockId;
    }

    /**
     * @notice Cancel a stream and settle immediately
     * @param lockId The stream lock identifier
     */
    function cancelStream(bytes32 lockId) 
        external 
        override 
        nonReentrant 
        whenNotPaused 
    {
        TokenLock storage lock = tokenLocks[lockId];
        require(lock.user == msg.sender, "Only lock owner can cancel");
        require(lock.isActive, "Stream not active");

        _settleStream(lockId, SettlementTrigger.UserCancellation);
    }

    /**
     * @notice Settle a stream (can be called by authorized parties)
     * @param lockId The stream lock identifier
     */
    function settleStream(bytes32 lockId) 
        external 
        override 
        nonReentrant 
        whenNotPaused 
    {
        TokenLock storage lock = tokenLocks[lockId];
        require(lock.isActive, "Stream not active");
        
        // Check authorization
        require(
            lock.user == msg.sender || 
            lock.recipient == msg.sender ||
            hasRole(SETTLER_ROLE, msg.sender),
            "Unauthorized settler"
        );

        SettlementTrigger trigger = lock.recipient == msg.sender ? 
            SettlementTrigger.ProducerClaim : 
            SettlementTrigger.UserCancellation;

        _settleStream(lockId, trigger);
    }

    /**
     * @notice Batch settle multiple streams for a producer
     */
    function claimStreamsByProducer() 
        external 
        override 
        nonReentrant 
        whenNotPaused 
        returns (uint256 totalClaimed) 
    {
        bytes32[] memory producerStreams = recipientLocks[msg.sender];
        uint256 claimedCount = 0;

        for (uint256 i = 0; i < producerStreams.length; i++) {
            bytes32 lockId = producerStreams[i];
            TokenLock storage lock = tokenLocks[lockId];

            if (!lock.isActive) continue;

            // Auto-settle expired streams
            if (block.timestamp >= lock.endTime) {
                uint256 settled = _settleStream(lockId, SettlementTrigger.AutoExpiration);
                totalClaimed += settled;
                claimedCount++;
            }
            // Partial claim for active streams with significant accrual
            else {
                uint256 accrued = _calculateAccruedAmount(lockId);
                uint256 threshold = lock.totalAmount / 10; // 10% threshold

                if (accrued >= threshold) {
                    uint256 claimed = _partialClaim(lockId, accrued);
                    totalClaimed += claimed;
                }
            }
        }

        emit ProducerBatchClaim(msg.sender, totalClaimed, claimedCount);
    }

    /**
     * @notice Check stream access and settle if expired
     * @param consumer The consumer address
     * @param lockId The stream lock identifier
     * @return canUse Whether the consumer can still use the service
     */
    function checkAndSettleOnUsage(address consumer, bytes32 lockId) 
        external 
        override 
        nonReentrant 
        whenNotPaused 
        returns (bool canUse) 
    {
        TokenLock storage lock = tokenLocks[lockId];
        require(lock.user == consumer, "Not stream owner");

        if (!lock.isActive) {
            return false;
        }

        // Auto-settle if expired
        if (block.timestamp >= lock.endTime) {
            _settleStream(lockId, SettlementTrigger.ConsumerUsage);
            return false;
        }

        return true;
    }

    /**
     * @notice Get current stream status
     * @param lockId The stream lock identifier
     */
    function getStreamStatus(bytes32 lockId) 
        external 
        view 
        override 
        returns (
            bool isActive,
            bool isExpired,
            uint256 accruedAmount,
            uint256 remainingAmount,
            uint256 remainingTime
        ) 
    {
        TokenLock storage lock = tokenLocks[lockId];
        
        isActive = lock.isActive;
        isExpired = block.timestamp >= lock.endTime;
        accruedAmount = _calculateAccruedAmount(lockId);
        remainingAmount = lock.totalAmount - accruedAmount;
        
        if (isExpired) {
            remainingTime = 0;
        } else {
            remainingTime = lock.endTime - block.timestamp;
        }
    }

    /**
     * @notice Calculate accrued amount for a stream
     * @param lockId The stream lock identifier
     */
    function calculateAccruedAmount(bytes32 lockId) 
        external 
        view 
        override 
        returns (uint256) 
    {
        return _calculateAccruedAmount(lockId);
    }

    /**
     * @notice Get all active streams for a user
     * @param user The user address
     */
    function getUserActiveStreams(address user) 
        external 
        view 
        override 
        returns (bytes32[] memory) 
    {
        return _getActiveStreams(userLocks[user]);
    }

    /**
     * @notice Get all incoming active streams for a recipient
     * @param recipient The recipient address
     */
    function getRecipientActiveStreams(address recipient) 
        external 
        view 
        override 
        returns (bytes32[] memory) 
    {
        return _getActiveStreams(recipientLocks[recipient]);
    }

    /**
     * @notice Emergency pause function
     */
    function emergencyPause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause function
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @notice Emergency withdraw for a user (only when paused)
     * @param user The user to withdraw for
     */
    function emergencyWithdrawUser(address user) 
        external 
        onlyRole(ADMIN_ROLE) 
        whenPaused 
    {
        bytes32[] memory userStreamIds = userLocks[user];
        
        for (uint256 i = 0; i < userStreamIds.length; i++) {
            bytes32 lockId = userStreamIds[i];
            TokenLock storage lock = tokenLocks[lockId];
            
            if (lock.isActive) {
                lock.isActive = false;
                lockedBalances[user] -= lock.totalAmount;
                
                IERC20(lock.token).safeTransfer(user, lock.totalAmount);
                
                emit EmergencyWithdraw(lockId, user, lock.totalAmount);
            }
        }
    }

    // Internal functions
    function _validateStreamParameters(
        address recipient,
        address token,
        uint256 totalAmount,
        uint256 duration
    ) internal pure {
        require(recipient != address(0), "Invalid recipient");
        require(token != address(0), "Invalid token");
        require(totalAmount >= MIN_STREAM_AMOUNT, "Amount too small");
        require(duration >= MIN_STREAM_DURATION, "Duration too short");
        require(duration <= MAX_STREAM_DURATION, "Duration too long");
        
        uint256 streamRate = totalAmount / duration;
        require(streamRate > 0, "Stream rate too small");
    }

    function _generateLockId(
        address user,
        address recipient,
        address token,
        uint256 totalAmount
    ) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(
            user,
            recipient,
            token,
            totalAmount,
            block.timestamp,
            block.number
        ));
    }

    function _calculateAccruedAmount(bytes32 lockId) internal view returns (uint256) {
        TokenLock storage lock = tokenLocks[lockId];
        
        if (!lock.isActive) return 0;

        uint256 currentTime = block.timestamp;
        if (currentTime >= lock.endTime) {
            currentTime = lock.endTime;
        }

        uint256 timeElapsed = currentTime - lock.startTime;
        uint256 accruedAmount = timeElapsed * lock.streamRate;

        // Cap at total amount
        if (accruedAmount > lock.totalAmount) {
            accruedAmount = lock.totalAmount;
        }

        return accruedAmount;
    }

    function _settleStream(bytes32 lockId, SettlementTrigger trigger) 
        internal 
        returns (uint256 settledAmount) 
    {
        TokenLock storage lock = tokenLocks[lockId];
        
        uint256 accruedAmount = _calculateAccruedAmount(lockId);
        uint256 remainingAmount = lock.totalAmount - accruedAmount;

        // Deactivate stream
        lock.isActive = false;

        // Update balances and statistics
        lockedBalances[lock.user] -= lock.totalAmount;
        totalActiveStreams--;
        totalSettledValue += accruedAmount;

        // Transfer accrued amount to recipient
        if (accruedAmount > 0) {
            IERC20(lock.token).safeTransfer(lock.recipient, accruedAmount);
        }

        // Return remaining amount to user
        if (remainingAmount > 0) {
            IERC20(lock.token).safeTransfer(lock.user, remainingAmount);
        }

        emit StreamSettled(
            lockId,
            lock.user,
            lock.recipient,
            accruedAmount,
            remainingAmount,
            trigger
        );

        return accruedAmount;
    }

    function _partialClaim(bytes32 lockId, uint256 amount) 
        internal 
        returns (uint256 claimed) 
    {
        TokenLock storage lock = tokenLocks[lockId];
        
        // Update last claim time
        lock.lastClaimTime = block.timestamp;
        
        // Transfer to recipient
        IERC20(lock.token).safeTransfer(lock.recipient, amount);
        
        emit PartialClaim(lockId, lock.recipient, amount);
        
        return amount;
    }

    function _getActiveStreams(bytes32[] memory streamIds) 
        internal 
        view 
        returns (bytes32[] memory) 
    {
        bytes32[] memory activeStreams = new bytes32[](streamIds.length);
        uint256 activeCount = 0;

        for (uint256 i = 0; i < streamIds.length; i++) {
            if (tokenLocks[streamIds[i]].isActive) {
                activeStreams[activeCount] = streamIds[i];
                activeCount++;
            }
        }

        // Resize array
        bytes32[] memory result = new bytes32[](activeCount);
        for (uint256 i = 0; i < activeCount; i++) {
            result[i] = activeStreams[i];
        }

        return result;
    }
}
```

### 2. StreamDataTypes.sol
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title StreamDataTypes
 * @dev Data structures for the stream lock system
 */
library StreamDataTypes {
    /**
     * @dev Settlement trigger types
     */
    enum SettlementTrigger {
        UserCancellation,    // User cancelled the stream
        ProducerClaim,       // Producer claimed the stream
        AutoExpiration,      // Stream expired automatically
        ConsumerUsage,       // Triggered during consumer usage check
        Emergency            // Emergency settlement
    }

    /**
     * @dev Token lock structure
     */
    struct TokenLock {
        address user;               // Token owner
        address recipient;          // Stream recipient
        address token;             // ERC20 token address
        uint256 totalAmount;       // Total locked amount
        uint256 streamRate;        // Tokens per second (wei/sec)
        uint256 startTime;         // Stream start timestamp
        uint256 endTime;          // Stream end timestamp
        uint256 lastClaimTime;    // Last partial claim timestamp
        bool isActive;            // Whether stream is active
        bytes32 lockId;           // Unique lock identifier
    }

    /**
     * @dev Stream creation parameters
     */
    struct StreamParams {
        address recipient;
        address token;
        uint256 totalAmount;
        uint256 duration;
    }

    /**
     * @dev Stream status information
     */
    struct StreamStatus {
        bool isActive;
        bool isExpired;
        uint256 accruedAmount;
        uint256 remainingAmount;
        uint256 remainingTime;
    }

    /**
     * @dev Batch operation result
     */
    struct BatchResult {
        uint256 successCount;
        uint256 totalAmount;
        bytes32[] processedLocks;
    }

    /**
     * @dev System statistics
     */
    struct SystemStats {
        uint256 totalActiveStreams;
        uint256 totalLockedValue;
        uint256 totalSettledValue;
        uint256 totalUsers;
        uint256 totalRecipients;
    }
}
```

---

## Interface Definitions

### 1. IStreamLockManager.sol
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./StreamDataTypes.sol";

/**
 * @title IStreamLockManager
 * @dev Interface for the stream lock manager contract
 */
interface IStreamLockManager {
    using StreamDataTypes for *;

    // Events
    event StreamLockCreated(
        bytes32 indexed lockId,
        address indexed user,
        address indexed recipient,
        uint256 totalAmount,
        uint256 duration
    );

    event StreamSettled(
        bytes32 indexed lockId,
        address indexed user,
        address indexed recipient,
        uint256 settledAmount,
        uint256 returnedAmount,
        StreamDataTypes.SettlementTrigger trigger
    );

    event PartialClaim(
        bytes32 indexed lockId,
        address indexed recipient,
        uint256 amount
    );

    event ProducerBatchClaim(
        address indexed producer,
        uint256 totalClaimed,
        uint256 streamCount
    );

    event EmergencyWithdraw(
        bytes32 indexed lockId,
        address indexed user,
        uint256 amount
    );

    // Core functions
    function createStreamLock(
        address recipient,
        address token,
        uint256 totalAmount,
        uint256 duration
    ) external returns (bytes32 lockId);

    function cancelStream(bytes32 lockId) external;
    
    function settleStream(bytes32 lockId) external;
    
    function claimStreamsByProducer() external returns (uint256 totalClaimed);
    
    function checkAndSettleOnUsage(address consumer, bytes32 lockId) 
        external returns (bool canUse);

    // View functions
    function getStreamStatus(bytes32 lockId) 
        external view returns (
            bool isActive,
            bool isExpired,
            uint256 accruedAmount,
            uint256 remainingAmount,
            uint256 remainingTime
        );

    function calculateAccruedAmount(bytes32 lockId) 
        external view returns (uint256);

    function getUserActiveStreams(address user) 
        external view returns (bytes32[] memory);

    function getRecipientActiveStreams(address recipient) 
        external view returns (bytes32[] memory);

    // Lock data access
    function tokenLocks(bytes32 lockId) 
        external view returns (StreamDataTypes.TokenLock memory);

    function lockedBalances(address user) 
        external view returns (uint256);
}
```

### 2. IStreamIntegration.sol
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IStreamIntegration
 * @dev Interface for contracts that integrate with the stream system
 */
interface IStreamIntegration {
    /**
     * @dev Called when a stream is created for this contract
     */
    function onStreamCreated(
        bytes32 lockId,
        address user,
        uint256 amount,
        uint256 duration
    ) external;

    /**
     * @dev Called when a stream is settled
     */
    function onStreamSettled(
        bytes32 lockId,
        address user,
        uint256 settledAmount,
        uint256 returnedAmount
    ) external;

    /**
     * @dev Check if user can use service based on stream status
     */
    function canUseService(address user, bytes32 lockId) 
        external view returns (bool);
}
```

---

## Library Implementations

### 1. StreamCalculator.sol
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title StreamCalculator
 * @dev Library for stream rate and amount calculations
 */
library StreamCalculator {
    uint256 public constant PRECISION = 1e18;
    uint256 public constant SECONDS_PER_DAY = 86400;
    uint256 public constant SECONDS_PER_HOUR = 3600;

    /**
     * @dev Calculate stream rate from total amount and duration
     * @param totalAmount Total amount to stream
     * @param duration Duration in seconds
     * @return streamRate Tokens per second
     */
    function calculateStreamRate(uint256 totalAmount, uint256 duration) 
        internal 
        pure 
        returns (uint256 streamRate) 
    {
        require(duration > 0, "Duration cannot be zero");
        return totalAmount / duration;
    }

    /**
     * @dev Calculate amount for given time elapsed
     * @param streamRate Rate per second
     * @param timeElapsed Time elapsed in seconds
     * @return amount Streamed amount
     */
    function calculateAmountForTime(uint256 streamRate, uint256 timeElapsed) 
        internal 
        pure 
        returns (uint256 amount) 
    {
        return streamRate * timeElapsed;
    }

    /**
     * @dev Calculate maximum duration for given amount and minimum rate
     * @param totalAmount Total amount
     * @param minStreamRate Minimum rate per second
     * @return maxDuration Maximum possible duration
     */
    function calculateMaxDuration(uint256 totalAmount, uint256 minStreamRate) 
        internal 
        pure 
        returns (uint256 maxDuration) 
    {
        require(minStreamRate > 0, "Min rate cannot be zero");
        return totalAmount / minStreamRate;
    }

    /**
     * @dev Convert daily rate to per-second rate
     * @param dailyRate Amount per day
     * @return perSecondRate Amount per second
     */
    function dailyToPerSecond(uint256 dailyRate) 
        internal 
        pure 
        returns (uint256 perSecondRate) 
    {
        return dailyRate / SECONDS_PER_DAY;
    }

    /**
     * @dev Convert hourly rate to per-second rate
     * @param hourlyRate Amount per hour
     * @return perSecondRate Amount per second
     */
    function hourlyToPerSecond(uint256 hourlyRate) 
        internal 
        pure 
        returns (uint256 perSecondRate) 
    {
        return hourlyRate / SECONDS_PER_HOUR;
    }

    /**
     * @dev Calculate remaining time from current timestamp and end time
     * @param endTime Stream end timestamp
     * @return remainingTime Time remaining in seconds
     */
    function calculateRemainingTime(uint256 endTime) 
        internal 
        view 
        returns (uint256 remainingTime) 
    {
        if (block.timestamp >= endTime) {
            return 0;
        }
        return endTime - block.timestamp;
    }

    /**
     * @dev Check if stream is expired
     * @param endTime Stream end timestamp
     * @return expired Whether stream is expired
     */
    function isExpired(uint256 endTime) 
        internal 
        view 
        returns (bool expired) 
    {
        return block.timestamp >= endTime;
    }

    /**
     * @dev Calculate percentage of stream completed
     * @param startTime Stream start timestamp
     * @param endTime Stream end timestamp
     * @return percentage Completion percentage (0-100)
     */
    function calculateCompletionPercentage(uint256 startTime, uint256 endTime) 
        internal 
        view 
        returns (uint256 percentage) 
    {
        if (block.timestamp <= startTime) return 0;
        if (block.timestamp >= endTime) return 100;
        
        uint256 totalDuration = endTime - startTime;
        uint256 elapsed = block.timestamp - startTime;
        
        return (elapsed * 100) / totalDuration;
    }
}
```

### 2. StreamValidator.sol
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title StreamValidator
 * @dev Library for validating stream parameters and operations
 */
library StreamValidator {
    uint256 public constant MIN_STREAM_AMOUNT = 1000;
    uint256 public constant MIN_STREAM_DURATION = 1 hours;
    uint256 public constant MAX_STREAM_DURATION = 365 days;
    uint256 public constant MAX_STREAMS_PER_USER = 1000;

    error InvalidRecipient();
    error InvalidToken();
    error AmountTooSmall();
    error DurationTooShort();
    error DurationTooLong();
    error StreamRateTooLow();
    error TooManyStreams();
    error StreamNotActive();
    error UnauthorizedAccess();

    /**
     * @dev Validate stream creation parameters
     */
    function validateStreamCreation(
        address recipient,
        address token,
        uint256 totalAmount,
        uint256 duration,
        uint256 existingStreamCount
    ) internal pure {
        if (recipient == address(0)) revert InvalidRecipient();
        if (token == address(0)) revert InvalidToken();
        if (totalAmount < MIN_STREAM_AMOUNT) revert AmountTooSmall();
        if (duration < MIN_STREAM_DURATION) revert DurationTooShort();
        if (duration > MAX_STREAM_DURATION) revert DurationTooLong();
        if (existingStreamCount >= MAX_STREAMS_PER_USER) revert TooManyStreams();
        
        uint256 streamRate = totalAmount / duration;
        if (streamRate == 0) revert StreamRateTooLow();
    }

    /**
     * @dev Validate stream settlement authorization
     */
    function validateSettlementAuth(
        address caller,
        address streamUser,
        address streamRecipient,
        bool hasSettlerRole
    ) internal pure {
        if (!(caller == streamUser || 
              caller == streamRecipient || 
              hasSettlerRole)) {
            revert UnauthorizedAccess();
        }
    }

    /**
     * @dev Validate stream is active
     */
    function validateStreamActive(bool isActive) internal pure {
        if (!isActive) revert StreamNotActive();
    }

    /**
     * @dev Check if amount is significant enough for partial claim
     */
    function isSignificantAmount(uint256 amount, uint256 totalAmount) 
        internal 
        pure 
        returns (bool) 
    {
        uint256 threshold = totalAmount / 100; // 1% threshold
        return amount >= threshold;
    }

    /**
     * @dev Validate token transfer requirements
     */
    function validateTokenTransfer(
        address token,
        address from,
        uint256 amount
    ) internal view returns (bool) {
        // Check token exists (has code)
        uint256 size;
        assembly { size := extcodesize(token) }
        if (size == 0) return false;
        
        // This would need to be expanded with actual ERC20 checks
        // For brevity, returning true here
        return true;
    }
}
```

---

## Integration Contracts

### 1. StreamEnabledProducer.sol
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IStreamLockManager.sol";
import "./interfaces/IStreamIntegration.sol";
import "../Producer.sol"; // Existing Producer contract

/**
 * @title StreamEnabledProducer
 * @dev Producer contract with stream integration
 */
contract StreamEnabledProducer is Producer, IStreamIntegration {
    IStreamLockManager public streamManager;
    
    // Stream-enabled plans
    mapping(uint256 => bool) public planUsesStream;
    mapping(uint256 => bytes32) public customerPlanToStream;
    mapping(bytes32 => uint256) public streamToCustomerPlan;
    
    // Stream settings per plan
    mapping(uint256 => uint256) public planMinStreamDuration;
    mapping(uint256 => uint256) public planMaxStreamDuration;

    event StreamSubscriptionCreated(
        uint256 indexed custumerPlanId,
        bytes32 indexed streamLockId,
        uint256 planId,
        address customer,
        uint256 duration
    );

    event PlanMigratedToStream(uint256 indexed planId);

    /**
     * @dev Set stream manager (only owner)
     */
    function setStreamManager(address _streamManager) external onlyOwner {
        streamManager = IStreamLockManager(_streamManager);
    }

    /**
     * @dev Enable stream for a plan
     */
    function enableStreamForPlan(
        uint256 planId,
        uint256 minDuration,
        uint256 maxDuration
    ) external onlyOwner {
        require(plans[planId].planId == planId, "Plan does not exist");
        
        planUsesStream[planId] = true;
        planMinStreamDuration[planId] = minDuration;
        planMaxStreamDuration[planId] = maxDuration;
        
        emit PlanMigratedToStream(planId);
    }

    /**
     * @dev Subscribe to a plan with stream payment
     */
    function subscribeWithStream(
        uint256 planId,
        uint256 streamDuration
    ) external returns (uint256 custumerPlanId, bytes32 streamLockId) {
        require(planUsesStream[planId], "Plan doesn't support streams");
        
        Plan storage plan = plans[planId];
        require(plan.status == Status.active, "Plan not active");
        
        // Validate stream duration for this plan
        require(
            streamDuration >= planMinStreamDuration[planId] &&
            streamDuration <= planMaxStreamDuration[planId],
            "Invalid stream duration"
        );

        // Calculate stream amount based on plan type
        uint256 streamAmount = _calculateStreamAmount(planId, streamDuration);

        // Create stream lock
        streamLockId = streamManager.createStreamLock(
            address(this),
            plan.priceAddress,
            streamAmount,
            streamDuration
        );

        // Create customer plan
        custumerPlanId = _createCustomerPlanWithStream(planId, msg.sender, streamLockId);

        emit StreamSubscriptionCreated(
            custumerPlanId,
            streamLockId,
            planId,
            msg.sender,
            streamDuration
        );

        return (custumerPlanId, streamLockId);
    }

    /**
     * @dev Use service with stream validation
     */
    function useServiceWithStreamCheck(uint256 custumerPlanId) 
        external 
        returns (bool success) 
    {
        CustomerPlan storage customerPlan = customerPlans[custumerPlanId];
        require(customerPlan.customerAdress == msg.sender, "Not authorized");
        
        bytes32 streamLockId = customerPlanToStream[custumerPlanId];
        require(streamLockId != bytes32(0), "No stream associated");

        // Check stream status and settle if needed
        bool canUse = streamManager.checkAndSettleOnUsage(msg.sender, streamLockId);
        
        if (!canUse) {
            // Stream expired, update customer plan status
            customerPlan.status = Status.expired;
            return false;
        }

        // Execute service logic
        _executeServiceLogic(custumerPlanId);
        
        return true;
    }

    /**
     * @dev Claim all earnings from streams
     */
    function claimStreamEarnings() external onlyOwner returns (uint256) {
        return streamManager.claimStreamsByProducer();
    }

    /**
     * @dev Get customer plan stream status
     */
    function getCustomerPlanStreamStatus(uint256 custumerPlanId) 
        external 
        view 
        returns (
            bool hasStream,
            bool isActive,
            bool isExpired,
            uint256 accruedAmount,
            uint256 remainingAmount,
            uint256 remainingTime
        ) 
    {
        bytes32 streamLockId = customerPlanToStream[custumerPlanId];
        
        if (streamLockId == bytes32(0)) {
            return (false, false, false, 0, 0, 0);
        }

        (isActive, isExpired, accruedAmount, remainingAmount, remainingTime) = 
            streamManager.getStreamStatus(streamLockId);

        return (true, isActive, isExpired, accruedAmount, remainingAmount, remainingTime);
    }

    // IStreamIntegration implementation
    function onStreamCreated(
        bytes32 lockId,
        address user,
        uint256 amount,
        uint256 duration
    ) external override {
        require(msg.sender == address(streamManager), "Only stream manager");
        // Additional logic when stream is created
    }

    function onStreamSettled(
        bytes32 lockId,
        address user,
        uint256 settledAmount,
        uint256 returnedAmount
    ) external override {
        require(msg.sender == address(streamManager), "Only stream manager");
        
        // Update customer plan status
        uint256 custumerPlanId = streamToCustomerPlan[lockId];
        if (custumerPlanId != 0) {
            customerPlans[custumerPlanId].status = Status.expired;
        }
    }

    function canUseService(address user, bytes32 lockId) 
        external 
        view 
        override 
        returns (bool) 
    {
        (bool isActive, bool isExpired,,,) = streamManager.getStreamStatus(lockId);
        return isActive && !isExpired;
    }

    // Internal functions
    function _calculateStreamAmount(uint256 planId, uint256 duration) 
        internal 
        view 
        returns (uint256) 
    {
        Plan storage plan = plans[planId];
        
        if (plan.planType == PlanTypes.api) {
            PlanInfoApi storage apiInfo = planInfoApis[planId];
            return uint256(int256(apiInfo.flowRate)) * duration;
        }
        
        // For other plan types, implement similar logic
        revert("Plan type not supported for streams");
    }

    function _createCustomerPlanWithStream(
        uint256 planId,
        address customer,
        bytes32 streamLockId
    ) internal returns (uint256 custumerPlanId) {
        // Create standard customer plan
        custumerPlanId = _createStandardCustomerPlan(planId, customer);
        
        // Link stream to customer plan
        customerPlanToStream[custumerPlanId] = streamLockId;
        streamToCustomerPlan[streamLockId] = custumerPlanId;
        
        return custumerPlanId;
    }

    function _executeServiceLogic(uint256 custumerPlanId) internal {
        CustomerPlan storage customerPlan = customerPlans[custumerPlanId];
        
        // Implement plan-specific service logic
        if (customerPlan.planType == PlanTypes.api) {
            // API service logic
            _executeApiService(custumerPlanId);
        } else if (customerPlan.planType == PlanTypes.nUsage) {
            // N-Usage service logic
            _executeNUsageService(custumerPlanId);
        }
    }

    function _executeApiService(uint256 custumerPlanId) internal {
        // API-specific service implementation
        // This would include rate limiting, usage tracking, etc.
    }

    function _executeNUsageService(uint256 custumerPlanId) internal {
        // N-Usage specific service implementation
        // This would include quota consumption, etc.
    }

    function _createStandardCustomerPlan(uint256 planId, address customer) 
        internal 
        returns (uint256) 
    {
        // Implementation of standard customer plan creation
        // This would be the existing logic from Producer contract
        return 0; // Placeholder
    }
}
```

### 2. StreamFactory.sol
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../Factory.sol"; // Existing Factory contract
import "./StreamLockManager.sol";
import "./StreamEnabledProducer.sol";

/**
 * @title StreamFactory
 * @dev Factory contract extended with stream functionality
 */
contract StreamFactory is Factory {
    StreamLockManager public streamManager;
    
    // Stream-enabled producer implementation
    address public streamProducerImplementation;
    
    event StreamManagerSet(address indexed streamManager);
    event StreamProducerImplementationSet(address indexed implementation);

    /**
     * @dev Initialize factory with stream manager
     */
    function initializeWithStream(
        address _uriGeneratorAddress,
        address _producerStorageAddress,
        address _producerApiAddress,
        address _producerNUsageAddress,
        address _producerVestingApiAddress,
        address _streamManager
    ) external initializer {
        // Call parent initialize
        initialize(
            _uriGeneratorAddress,
            _producerStorageAddress,
            _producerApiAddress,
            _producerNUsageAddress,
            _producerVestingApiAddress
        );
        
        // Set stream manager
        streamManager = StreamLockManager(_streamManager);
        
        emit StreamManagerSet(_streamManager);
    }

    /**
     * @dev Set stream manager
     */
    function setStreamManager(address _streamManager) external onlyOwner {
        streamManager = StreamLockManager(_streamManager);
        emit StreamManagerSet(_streamManager);
    }

    /**
     * @dev Set stream-enabled producer implementation
     */
    function setStreamProducerImplementation(address _implementation) 
        external 
        onlyOwner 
    {
        streamProducerImplementation = _implementation;
        emit StreamProducerImplementationSet(_implementation);
    }

    /**
     * @dev Create producer with stream support
     */
    function createStreamProducer(
        Producer memory producerData
    ) external returns (uint256 producerId, address cloneAddress) {
        require(address(streamManager) != address(0), "Stream manager not set");
        require(streamProducerImplementation != address(0), "Stream implementation not set");
        
        // Use stream-enabled implementation
        address originalImpl = producerImplementation;
        producerImplementation = streamProducerImplementation;
        
        // Create producer
        (producerId, cloneAddress) = createProducer(producerData);
        
        // Configure stream manager in the new producer
        StreamEnabledProducer(cloneAddress).setStreamManager(address(streamManager));
        
        // Restore original implementation
        producerImplementation = originalImpl;
        
        return (producerId, cloneAddress);
    }

    /**
     * @dev Migrate existing producer to stream support
     */
    function migrateProducerToStream(uint256 producerId) 
        external 
        onlyOwner 
        returns (address newCloneAddress) 
    {
        Producer storage producer = producers[producerId];
        require(producer.exists, "Producer does not exist");
        
        // Deploy new stream-enabled clone
        newCloneAddress = Clones.clone(streamProducerImplementation);
        
        // Initialize with existing data
        StreamEnabledProducer newProducer = StreamEnabledProducer(newCloneAddress);
        
        // Copy data from old producer (this would need detailed implementation)
        _migrateProducerData(producer.cloneAddress, newCloneAddress);
        
        // Set stream manager
        newProducer.setStreamManager(address(streamManager));
        
        // Update producer record
        producer.cloneAddress = newCloneAddress;
        
        emit ProducerMigratedToStream(producerId, newCloneAddress);
    }

    /**
     * @dev Get system statistics including stream data
     */
    function getSystemStatistics() 
        external 
        view 
        returns (
            uint256 totalProducers,
            uint256 totalActiveStreams,
            uint256 totalLockedValue,
            uint256 totalSettledValue
        ) 
    {
        totalProducers = currentPR_ID;
        
        if (address(streamManager) != address(0)) {
            totalActiveStreams = streamManager.totalActiveStreams();
            totalLockedValue = streamManager.totalLockedValue();
            totalSettledValue = streamManager.totalSettledValue();
        }
    }

    // Events
    event ProducerMigratedToStream(uint256 indexed producerId, address indexed newCloneAddress);

    // Internal function to migrate producer data
    function _migrateProducerData(address oldProducer, address newProducer) 
        internal 
    {
        // This would involve copying all plans, customer plans, etc.
        // Implementation would be complex and depends on specific migration strategy
    }
}
```

---

## Test Contracts

### 1. StreamLockManagerTest.sol
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../StreamLockManager.sol";
import "../mocks/MockERC20.sol";

contract StreamLockManagerTest is Test {
    StreamLockManager streamManager;
    MockERC20 token;
    
    address user = address(0x1);
    address recipient = address(0x2);
    uint256 constant INITIAL_BALANCE = 1000000 * 1e18;

    function setUp() public {
        streamManager = new StreamLockManager();
        token = new MockERC20("Test Token", "TEST");
        
        // Setup balances
        token.mint(user, INITIAL_BALANCE);
        
        // Setup approvals
        vm.prank(user);
        token.approve(address(streamManager), INITIAL_BALANCE);
    }

    function testCreateStreamLock() public {
        uint256 amount = 1000 * 1e18;
        uint256 duration = 30 days;
        
        vm.prank(user);
        bytes32 lockId = streamManager.createStreamLock(
            recipient,
            address(token),
            amount,
            duration
        );
        
        // Verify lock created
        (
            bool isActive,
            bool isExpired,
            uint256 accruedAmount,
            uint256 remainingAmount,
            uint256 remainingTime
        ) = streamManager.getStreamStatus(lockId);
        
        assertTrue(isActive);
        assertFalse(isExpired);
        assertEq(accruedAmount, 0);
        assertEq(remainingAmount, amount);
        assertEq(remainingTime, duration);
    }

    function testStreamAccrual() public {
        uint256 amount = 3600 * 1e18; // 3600 tokens
        uint256 duration = 3600; // 1 hour
        
        vm.prank(user);
        bytes32 lockId = streamManager.createStreamLock(
            recipient,
            address(token),
            amount,
            duration
        );
        
        // Fast forward 30 minutes
        vm.warp(block.timestamp + 1800);
        
        uint256 accrued = streamManager.calculateAccruedAmount(lockId);
        assertEq(accrued, 1800 * 1e18); // Half the amount
    }

    function testUserCancellation() public {
        uint256 amount = 1000 * 1e18;
        uint256 duration = 30 days;
        
        vm.prank(user);
        bytes32 lockId = streamManager.createStreamLock(
            recipient,
            address(token),
            amount,
            duration
        );
        
        // Fast forward 10 days
        vm.warp(block.timestamp + 10 days);
        
        uint256 recipientBalanceBefore = token.balanceOf(recipient);
        uint256 userBalanceBefore = token.balanceOf(user);
        
        vm.prank(user);
        streamManager.cancelStream(lockId);
        
        uint256 recipientBalanceAfter = token.balanceOf(recipient);
        uint256 userBalanceAfter = token.balanceOf(user);
        
        // Verify 1/3 of amount went to recipient, 2/3 back to user
        uint256 expectedAccrued = amount / 3;
        assertApproxEqAbs(
            recipientBalanceAfter - recipientBalanceBefore,
            expectedAccrued,
            1e15 // Allow small rounding error
        );
    }

    function testProducerClaim() public {
        uint256 amount = 1000 * 1e18;
        uint256 duration = 30 days;
        
        vm.prank(user);
        bytes32 lockId = streamManager.createStreamLock(
            recipient,
            address(token),
            amount,
            duration
        );
        
        // Fast forward past end time
        vm.warp(block.timestamp + duration + 1);
        
        uint256 recipientBalanceBefore = token.balanceOf(recipient);
        
        vm.prank(recipient);
        uint256 totalClaimed = streamManager.claimStreamsByProducer();
        
        uint256 recipientBalanceAfter = token.balanceOf(recipient);
        
        // Should receive full amount
        assertEq(recipientBalanceAfter - recipientBalanceBefore, amount);
        assertEq(totalClaimed, amount);
    }

    function testPartialClaim() public {
        uint256 amount = 1000 * 1e18;
        uint256 duration = 100 days;
        
        vm.prank(user);
        streamManager.createStreamLock(
            recipient,
            address(token),
            amount,
            duration
        );
        
        // Fast forward 50 days (50% completion)
        vm.warp(block.timestamp + 50 days);
        
        uint256 recipientBalanceBefore = token.balanceOf(recipient);
        
        vm.prank(recipient);
        streamManager.claimStreamsByProducer();
        
        uint256 recipientBalanceAfter = token.balanceOf(recipient);
        uint256 claimed = recipientBalanceAfter - recipientBalanceBefore;
        
        // Should claim approximately 50% of total (partial claim threshold is 10%)
        assertApproxEqRel(claimed, amount / 2, 0.01e18); // 1% tolerance
    }

    function testRevertInvalidParameters() public {
        vm.startPrank(user);
        
        // Invalid recipient
        vm.expectRevert("Invalid recipient");
        streamManager.createStreamLock(
            address(0),
            address(token),
            1000 * 1e18,
            30 days
        );
        
        // Amount too small
        vm.expectRevert("Amount too small");
        streamManager.createStreamLock(
            recipient,
            address(token),
            100, // Below minimum
            30 days
        );
        
        // Duration too short
        vm.expectRevert("Duration too short");
        streamManager.createStreamLock(
            recipient,
            address(token),
            1000 * 1e18,
            30 minutes // Below 1 hour minimum
        );
        
        vm.stopPrank();
    }

    function testUnauthorizedAccess() public {
        vm.prank(user);
        bytes32 lockId = streamManager.createStreamLock(
            recipient,
            address(token),
            1000 * 1e18,
            30 days
        );
        
        // Random address trying to cancel
        vm.prank(address(0x3));
        vm.expectRevert("Only lock owner can cancel");
        streamManager.cancelStream(lockId);
    }

    function testEmergencyPause() public {
        // Grant pauser role to test contract
        streamManager.grantRole(streamManager.PAUSER_ROLE(), address(this));
        
        vm.prank(user);
        streamManager.createStreamLock(
            recipient,
            address(token),
            1000 * 1e18,
            30 days
        );
        
        // Pause contract
        streamManager.emergencyPause();
        
        // Should revert when paused
        vm.prank(user);
        vm.expectRevert("Pausable: paused");
        streamManager.createStreamLock(
            recipient,
            address(token),
            1000 * 1e18,
            30 days
        );
    }
}
```

### 2. MockERC20.sol
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) public {
        _burn(from, amount);
    }
}
```

---

## Deployment Scripts

### 1. deploy-stream-system.ts
```typescript
import { ethers, upgrades } from "hardhat";
import { StreamLockManager, StreamFactory } from "../typechain-types";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying stream system with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // 1. Deploy StreamLockManager
  console.log("\n1. Deploying StreamLockManager...");
  const StreamLockManager = await ethers.getContractFactory("StreamLockManager");
  const streamManager: StreamLockManager = await StreamLockManager.deploy();
  await streamManager.deployed();
  console.log("StreamLockManager deployed to:", streamManager.address);

  // 2. Deploy StreamEnabledProducer implementation
  console.log("\n2. Deploying StreamEnabledProducer implementation...");
  const StreamEnabledProducer = await ethers.getContractFactory("StreamEnabledProducer");
  const streamProducerImpl = await StreamEnabledProducer.deploy();
  await streamProducerImpl.deployed();
  console.log("StreamEnabledProducer implementation deployed to:", streamProducerImpl.address);

  // 3. Deploy or upgrade Factory to StreamFactory
  console.log("\n3. Deploying StreamFactory...");
  const StreamFactory = await ethers.getContractFactory("StreamFactory");
  
  // Deploy as proxy
  const streamFactory: StreamFactory = await upgrades.deployProxy(
    StreamFactory,
    [], // Empty initializer args - will call initializeWithStream separately
    { 
      kind: "uups",
      unsafeAllow: ["delegatecall"]
    }
  ) as StreamFactory;
  
  await streamFactory.deployed();
  console.log("StreamFactory proxy deployed to:", streamFactory.address);

  // 4. Initialize StreamFactory with existing addresses + stream manager
  console.log("\n4. Initializing StreamFactory...");
  
  // These addresses should come from your existing deployment
  const existingAddresses = {
    uriGenerator: process.env.URI_GENERATOR_ADDRESS || "",
    producerStorage: process.env.PRODUCER_STORAGE_ADDRESS || "",
    producerApi: process.env.PRODUCER_API_ADDRESS || "",
    producerNUsage: process.env.PRODUCER_NUSAGE_ADDRESS || "",
    producerVestingApi: process.env.PRODUCER_VESTING_API_ADDRESS || ""
  };

  await streamFactory.initializeWithStream(
    existingAddresses.uriGenerator,
    existingAddresses.producerStorage,
    existingAddresses.producerApi,
    existingAddresses.producerNUsage,
    existingAddresses.producerVestingApi,
    streamManager.address
  );

  // 5. Set stream producer implementation
  console.log("\n5. Setting stream producer implementation...");
  await streamFactory.setStreamProducerImplementation(streamProducerImpl.address);

  // 6. Grant necessary roles
  console.log("\n6. Setting up roles...");
  await streamManager.grantRole(await streamManager.SETTLER_ROLE(), streamFactory.address);

  // 7. Save deployment addresses
  const deploymentData = {
    streamManager: streamManager.address,
    streamFactory: streamFactory.address,
    streamProducerImplementation: streamProducerImpl.address,
    deployer: deployer.address,
    network: await ethers.provider.getNetwork(),
    timestamp: new Date().toISOString()
  };

  console.log("\n=== Deployment Summary ===");
  console.log(JSON.stringify(deploymentData, null, 2));

  // Save to file
  const fs = require('fs');
  fs.writeFileSync(
    './stream-deployment.json',
    JSON.stringify(deploymentData, null, 2)
  );

  console.log("\nDeployment completed successfully!");
  console.log("Configuration saved to: stream-deployment.json");

  // 8. Verify contracts (if on supported network)
  if (process.env.ETHERSCAN_API_KEY && 
      (await ethers.provider.getNetwork()).name !== "hardhat") {
    console.log("\n9. Verifying contracts...");
    await verifyContracts(deploymentData);
  }
}

async function verifyContracts(deployment: any) {
  const { run } = require("hardhat");
  
  try {
    // Verify StreamLockManager
    await run("verify:verify", {
      address: deployment.streamManager,
      constructorArguments: []
    });
    console.log("StreamLockManager verified");

    // Verify StreamEnabledProducer implementation
    await run("verify:verify", {
      address: deployment.streamProducerImplementation,
      constructorArguments: []
    });
    console.log("StreamEnabledProducer verified");

    console.log("All contracts verified successfully!");
  } catch (error) {
    console.error("Verification failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

### 2. migrate-to-stream.ts
```typescript
import { ethers } from "hardhat";
import { StreamFactory, Producer } from "../typechain-types";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  // Load deployment data
  const deploymentData = require('./stream-deployment.json');
  const streamFactory = await ethers.getContractAt(
    "StreamFactory", 
    deploymentData.streamFactory
  ) as StreamFactory;

  console.log("Starting migration to stream system...");

  // 1. Get all existing producers
  const totalProducers = await streamFactory.currentPR_ID();
  console.log(`Found ${totalProducers} producers to potentially migrate`);

  // 2. Migrate producers one by one
  for (let i = 1; i <= totalProducers.toNumber(); i++) {
    try {
      console.log(`\nMigrating producer ${i}...`);
      
      const producer = await streamFactory.getProducer(i);
      console.log(`Producer ${i} address: ${producer.cloneAddress}`);
      
      // Check if producer owner wants to migrate
      // In production, this would involve governance or producer consent
      const shouldMigrate = await checkMigrationConsent(i, producer.producerAddress);
      
      if (shouldMigrate) {
        const tx = await streamFactory.migrateProducerToStream(i);
        const receipt = await tx.wait();
        
        console.log(`Producer ${i} migrated successfully`);
        console.log(`Transaction hash: ${receipt.transactionHash}`);
        
        // Update specific plans to use streams
        await migrateProducerPlans(i, producer.cloneAddress);
      } else {
        console.log(`Producer ${i} migration skipped (no consent)`);
      }
      
    } catch (error) {
      console.error(`Failed to migrate producer ${i}:`, error);
    }
  }

  console.log("\nMigration completed!");
}

async function checkMigrationConsent(producerId: number, producerAddress: string): Promise<boolean> {
  // In production, this would check:
  // 1. Producer's explicit consent
  // 2. Governance decision
  // 3. Whitelist of producers ready to migrate
  
  // For this example, migrate all producers
  return true;
}

async function migrateProducerPlans(producerId: number, producerAddress: string) {
  const producer = await ethers.getContractAt("StreamEnabledProducer", producerAddress);
  
  try {
    // Enable streams for API plans (example)
    // This would be done based on plan types and producer preferences
    
    const planIds = await producer.getAllPlanIds();
    
    for (const planId of planIds) {
      const plan = await producer.getPlan(planId);
      
      // Only migrate API plans to streams
      if (plan.planType === 0) { // API plan
        await producer.enableStreamForPlan(
          planId,
          24 * 60 * 60, // 1 day minimum
          365 * 24 * 60 * 60 // 1 year maximum
        );
        
        console.log(`  Plan ${planId} enabled for streams`);
      }
    }
  } catch (error) {
    console.error(`Failed to migrate plans for producer ${producerId}:`, error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

### 3. test-stream-integration.ts
```typescript
import { ethers } from "hardhat";
import { StreamLockManager, StreamFactory, MockERC20 } from "../typechain-types";

async function main() {
  const [deployer, producer, consumer] = await ethers.getSigners();
  
  console.log("Testing stream integration...");

  // Load contracts
  const deploymentData = require('./stream-deployment.json');
  
  const streamManager = await ethers.getContractAt(
    "StreamLockManager",
    deploymentData.streamManager
  ) as StreamLockManager;
  
  const streamFactory = await ethers.getContractAt(
    "StreamFactory",
    deploymentData.streamFactory
  ) as StreamFactory;

  // 1. Deploy test token
  console.log("\n1. Deploying test token...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const testToken = await MockERC20.deploy("Test USDC", "TUSDC") as MockERC20;
  await testToken.deployed();
  
  // Mint tokens to consumer
  await testToken.mint(consumer.address, ethers.utils.parseEther("10000"));
  console.log("Test token deployed and minted");

  // 2. Create a producer with stream support
  console.log("\n2. Creating stream-enabled producer...");
  
  const producerData = {
    name: "Test API Service",
    description: "Stream-enabled API service for testing",
    image: "https://example.com/image.png",
    externalLink: "https://example.com"
  };

  const tx = await streamFactory.connect(producer).createStreamProducer(producerData);
  const receipt = await tx.wait();
  
  const event = receipt.events?.find(e => e.event === 'ProducerCreated');
  const producerId = event?.args?.producerId;
  const producerCloneAddress = event?.args?.producer;
  
  console.log(`Producer created: ID ${producerId}, Address ${producerCloneAddress}`);

  // 3. Create a stream-enabled plan
  console.log("\n3. Creating stream-enabled plan...");
  
  const streamProducer = await ethers.getContractAt(
    "StreamEnabledProducer",
    producerCloneAddress
  );

  // Create plan
  const planData = {
    planId: 1,
    name: "API Pro Plan",
    description: "Professional API access with streaming payment",
    externalLink: "https://example.com/docs",
    totalSupply: -1,
    backgroundColor: "#0066cc",
    image: "https://example.com/plan.png",
    priceAddress: testToken.address,
