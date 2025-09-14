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
    using StreamRateCalculator for uint256;

    // Storage
    mapping(bytes32 => TokenLock) public tokenLocks;
    mapping(address => bytes32[]) public userLocks;      // User's lock IDs
    mapping(address => bytes32[]) public recipientLocks; // Producer's incoming locks
    mapping(uint256 => bytes32) public customerPlanStreams; // CustomerPlan ID -> Lock ID
    
    // System parameters
    uint256 public constant VERSION = 1;
    uint256 public minStreamAmount;
    uint256 public minStreamDuration;
    uint256 public maxStreamDuration;
    
    // Admin addresses
    mapping(address => bool) public authorizedCallers; // Factory, Producer contracts

    // Custom errors
    error StreamNotFound();
    error StreamNotActive();
    error StreamExpired();
    error UnauthorizedCaller();
    error InvalidStreamParams();
    error OnlyStreamOwner();
    error OnlyStreamRecipient();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initialize the contract
     * @param _owner Contract owner
     * @param _minStreamAmount Minimum stream amount
     * @param _minStreamDuration Minimum stream duration
     * @param _maxStreamDuration Maximum stream duration
     */
    function initialize(
        address _owner,
        uint256 _minStreamAmount,
        uint256 _minStreamDuration,
        uint256 _maxStreamDuration
    ) external initializer {
        __Ownable_init(_owner);
        __Pausable_init();
        __ReentrancyGuard_init();
        
        minStreamAmount = _minStreamAmount;
        minStreamDuration = _minStreamDuration;
        maxStreamDuration = _maxStreamDuration;
        
        _transferOwnership(_owner);
    }

    // Modifiers
    modifier onlyAuthorized() {
        if (!authorizedCallers[msg.sender] && msg.sender != owner()) {
            revert UnauthorizedCaller();
        }
        _;
    }

    modifier onlyStreamOwner(bytes32 lockId) {
        TokenLock storage lock = tokenLocks[lockId];
        if (lock.user != msg.sender) revert OnlyStreamOwner();
        _;
    }

    modifier onlyStreamRecipient(bytes32 lockId) {
        TokenLock storage lock = tokenLocks[lockId];
        if (lock.recipient != msg.sender) revert OnlyStreamRecipient();
        _;
    }

    modifier validLock(bytes32 lockId) {
        if (tokenLocks[lockId].user == address(0)) revert StreamNotFound();
        _;
    }

    /**
     * @dev Create a new stream lock
     * @param recipient Stream recipient (producer)
     * @param token ERC20 token address
     * @param totalAmount Total amount to stream
     * @param duration Stream duration in seconds
     * @return lockId Unique lock identifier
     */
    function createStreamLock(
        address recipient,
        address token,
        uint256 totalAmount,
        uint256 duration
    ) external nonReentrant whenNotPaused returns (bytes32 lockId) {
        return _createStreamLock(msg.sender, recipient, token, totalAmount, duration);
    }

    /**
     * @dev Create multiple streams in batch
     * @param params Array of stream parameters
     * @return lockIds Array of created lock IDs
     */
    function batchCreateStreams(
        StreamParams[] calldata params
    ) external nonReentrant whenNotPaused returns (bytes32[] memory lockIds) {
        lockIds = new bytes32[](params.length);
        
        for (uint256 i = 0; i < params.length; i++) {
            lockIds[i] = _createStreamLock(
                msg.sender,
                params[i].recipient,
                params[i].token,
                params[i].totalAmount,
                params[i].duration
            );
        }
    }

    /**
     * @dev Internal function to create stream lock
     */
    function _createStreamLock(
        address user,
        address recipient,
        address token,
        uint256 totalAmount,
        uint256 duration
    ) internal returns (bytes32 lockId) {
        // Validate parameters
        StreamRateCalculator.validateStreamParams(totalAmount, duration, recipient, token);
        
        if (totalAmount < minStreamAmount) revert InvalidStreamParams();
        if (duration < minStreamDuration || duration > maxStreamDuration) revert InvalidStreamParams();

        // Calculate stream rate
        uint256 streamRate = StreamRateCalculator.calculateStreamRate(totalAmount, duration);

        // Generate unique lock ID
        lockId = keccak256(abi.encodePacked(
            user,
            recipient,
            token,
            totalAmount,
            duration,
            block.timestamp,
            block.number
        ));

        // Deposit and lock tokens
        _depositBalance(user, token, totalAmount);
        _lockBalance(user, token, totalAmount);

        // Create lock record
        tokenLocks[lockId] = TokenLock({
            user: user,
            recipient: recipient,
            token: token,
            totalAmount: totalAmount,
            streamRate: streamRate,
            startTime: block.timestamp,
            endTime: block.timestamp + duration,
            lastClaimTime: block.timestamp,
            isActive: true,
            lockId: lockId,
            streamType: StreamType.REGULAR,
            cliffDate: 0,
            usageCount: 0,
            usedCount: 0,
            immediateAmount: 0
        });

        // Update mappings
        userLocks[user].push(lockId);
        recipientLocks[recipient].push(lockId);

        emit StreamLockCreated(lockId, user, recipient, token, totalAmount, duration);
    }

    /**
     * @dev Cancel a stream and settle accrued amount
     * @param lockId Stream lock ID
     */
    function cancelStream(bytes32 lockId) external validLock(lockId) onlyStreamOwner(lockId) nonReentrant {
        _settleStream(lockId, SettlementTrigger.UserCancellation);
    }

    /**
     * @dev Settle a stream (can be called by recipient or when expired)
     * @param lockId Stream lock ID
     */
    function settleStream(bytes32 lockId) external validLock(lockId) nonReentrant returns (uint256 settledAmount, uint256 returnedAmount) {
        TokenLock storage lock = tokenLocks[lockId];
        
        // Check authorization
        bool canSettle = (
            msg.sender == lock.user ||
            msg.sender == lock.recipient ||
            block.timestamp >= lock.endTime ||
            authorizedCallers[msg.sender]
        );
        
        require(canSettle, "Unauthorized settlement");
        
        SettlementTrigger trigger = SettlementTrigger.AutoExpiration;
        if (msg.sender == lock.user) trigger = SettlementTrigger.UserCancellation;
        else if (msg.sender == lock.recipient) trigger = SettlementTrigger.ProducerClaim;
        
        return _settleStream(lockId, trigger);
    }

    /**
     * @dev Internal settlement function
     */
    function _settleStream(
        bytes32 lockId,
        SettlementTrigger trigger
    ) internal returns (uint256 settledAmount, uint256 returnedAmount) {
        TokenLock storage lock = tokenLocks[lockId];
        
        if (!lock.isActive) revert StreamNotActive();

        // Calculate accrued amount
        uint256 accruedAmount = calculateAccruedAmount(lockId);
        uint256 remainingAmount = lock.totalAmount - accruedAmount;

        // Deactivate stream
        lock.isActive = false;

        // Release locked balance
        _releaseLockedBalance(lock.user, lock.token, lock.totalAmount);

        // Transfer accrued amount to recipient
        if (accruedAmount > 0) {
            _transferBalance(lock.user, lock.recipient, lock.token, accruedAmount, false);
        }

        // Return remaining amount to user
        if (remainingAmount > 0) {
            // No transfer needed as tokens stay in user's balance
            // Just emit event for tracking
        }

        emit StreamSettled(lockId, lock.user, lock.recipient, accruedAmount, remainingAmount, trigger);

        return (accruedAmount, remainingAmount);
    }

    /**
     * @dev Calculate accrued amount for a stream
     * @param lockId Stream lock ID
     * @return accruedAmount Amount accrued so far
     */
    function calculateAccruedAmount(bytes32 lockId) public view validLock(lockId) returns (uint256 accruedAmount) {
        TokenLock storage lock = tokenLocks[lockId];
        
        if (!lock.isActive) return 0;

        uint256 currentTime = block.timestamp;
        if (currentTime > lock.endTime) {
            currentTime = lock.endTime;
        }

        uint256 timeElapsed = currentTime - lock.startTime;
        uint256 totalAccrued = StreamRateCalculator.calculateAmountForTime(lock.streamRate, timeElapsed);

        // Ensure we don't exceed total amount
        if (totalAccrued > lock.totalAmount) {
            totalAccrued = lock.totalAmount;
        }

        return totalAccrued;
    }

    /**
     * @dev Calculate remaining amount for a stream
     * @param lockId Stream lock ID
     * @return remainingAmount Amount remaining
     */
    function calculateRemainingAmount(bytes32 lockId) public view validLock(lockId) returns (uint256 remainingAmount) {
        TokenLock storage lock = tokenLocks[lockId];
        uint256 accrued = calculateAccruedAmount(lockId);
        return lock.totalAmount - accrued;
    }

    /**
     * @dev Get comprehensive stream status
     * @param lockId Stream lock ID
     */
    function getStreamStatus(bytes32 lockId) external view validLock(lockId) returns (
        bool isActive,
        bool isExpired,
        uint256 accruedAmount,
        uint256 remainingAmount,
        uint256 remainingTime
    ) {
        TokenLock storage lock = tokenLocks[lockId];
        
        isActive = lock.isActive;
        isExpired = block.timestamp >= lock.endTime;
        accruedAmount = calculateAccruedAmount(lockId);
        remainingAmount = calculateRemainingAmount(lockId);
        remainingTime = StreamRateCalculator.calculateRemainingTime(lock.endTime, block.timestamp);
    }

    /**
     * @dev Get user's active streams
     * @param user User address
     * @return activeStreams Array of active lock IDs
     */
    function getUserActiveStreams(address user) external view returns (bytes32[] memory activeStreams) {
        bytes32[] memory userStreamIds = userLocks[user];
        bytes32[] memory tempActive = new bytes32[](userStreamIds.length);
        uint256 activeCount = 0;

        for (uint256 i = 0; i < userStreamIds.length; i++) {
            if (tokenLocks[userStreamIds[i]].isActive) {
                tempActive[activeCount] = userStreamIds[i];
                activeCount++;
            }
        }

        activeStreams = new bytes32[](activeCount);
        for (uint256 i = 0; i < activeCount; i++) {
            activeStreams[i] = tempActive[i];
        }
    }

    /**
     * @dev Get producer's incoming streams
     * @param producer Producer address
     * @return incomingStreams Array of incoming lock IDs
     */
    function getProducerIncomingStreams(address producer) external view returns (bytes32[] memory incomingStreams) {
        bytes32[] memory producerStreamIds = recipientLocks[producer];
        bytes32[] memory tempActive = new bytes32[](producerStreamIds.length);
        uint256 activeCount = 0;

        for (uint256 i = 0; i < producerStreamIds.length; i++) {
            if (tokenLocks[producerStreamIds[i]].isActive) {
                tempActive[activeCount] = producerStreamIds[i];
                activeCount++;
            }
        }

        incomingStreams = new bytes32[](activeCount);
        for (uint256 i = 0; i < activeCount; i++) {
            incomingStreams[i] = tempActive[i];
        }
    }

    /**
     * @dev Get token lock details
     * @param lockId Lock ID
     * @return lock Token lock structure
     */
    function getTokenLock(bytes32 lockId) external view validLock(lockId) returns (TokenLock memory lock) {
        return tokenLocks[lockId];
    }

    /**
     * @dev Claim streams by producer (batch claim)
     */
    function claimStreamsByProducer() external nonReentrant returns (uint256 totalClaimed) {
        bytes32[] memory producerStreams = recipientLocks[msg.sender];
        uint256 claimedCount = 0;

        for (uint256 i = 0; i < producerStreams.length; i++) {
            bytes32 lockId = producerStreams[i];
            TokenLock storage lock = tokenLocks[lockId];

            if (!lock.isActive) continue;

            // If stream is expired, settle it
            if (block.timestamp >= lock.endTime) {
                (uint256 settled,) = _settleStream(lockId, SettlementTrigger.ProducerClaim);
                totalClaimed += settled;
                claimedCount++;
            }
        }

        emit ProducerBatchClaim(msg.sender, totalClaimed, claimedCount);
    }

    /**
     * @dev Emergency withdraw (only by stream owner)
     * @param lockId Stream lock ID
     */
    function emergencyWithdraw(bytes32 lockId) external validLock(lockId) onlyStreamOwner(lockId) nonReentrant {
        TokenLock storage lock = tokenLocks[lockId];
        
        if (!lock.isActive) revert StreamNotActive();

        // Deactivate stream
        lock.isActive = false;

        // Release all locked balance back to user
        _releaseLockedBalance(lock.user, lock.token, lock.totalAmount);
        
        // Withdraw the unlocked balance to user
        _withdrawBalance(lock.user, lock.token, lock.totalAmount);

        emit EmergencyWithdraw(lockId, lock.user, lock.totalAmount);
    }

    // Integration functions for Producer contract

    /**
     * @dev Check stream status during consumer usage
     * @param consumer Consumer address
     * @param lockId Stream lock ID
     * @return canUse Whether consumer can use the service
     */
    function checkAndSettleOnUsage(address consumer, bytes32 lockId) external view onlyAuthorized returns (bool canUse) {
        TokenLock storage lock = tokenLocks[lockId];
        
        if (!lock.isActive) return false;
        if (lock.user != consumer) return false;
        
        uint256 accruedAmount = calculateAccruedAmount(lockId);
        
        // If stream has accrued amount, consumer can use
        return accruedAmount > 0;
    }

    /**
     * @dev Validate stream access
     * @param user User address
     * @param lockId Stream lock ID
     */
    function validateStreamAccess(address user, bytes32 lockId) external view returns (
        bool hasAccess,
        uint256 accruedAmount
    ) {
        TokenLock storage lock = tokenLocks[lockId];
        
        hasAccess = (lock.isActive && lock.user == user);
        accruedAmount = calculateAccruedAmount(lockId);
    }

    /**
     * @dev Create stream for customer plan (called by Factory/Producer)
     * @param customerPlanId Customer plan ID
     * @param customer Customer address
     * @param producer Producer address
     * @param token Token address
     * @param totalAmount Total amount
     * @param duration Duration
     * @return lockId Created lock ID
     */
    function createStreamForCustomerPlan(
        uint256 customerPlanId,
        address customer,
        address producer,
        address token,
        uint256 totalAmount,
        uint256 duration
    ) external onlyAuthorized nonReentrant returns (bytes32 lockId) {
        lockId = _createStreamLock(customer, producer, token, totalAmount, duration);
        
        customerPlanStreams[customerPlanId] = lockId;
        
        emit CustomerPlanStreamCreated(customerPlanId, lockId, customer, producer);
    }

    // Admin functions

    /**
     * @dev Set authorized caller
     * @param caller Caller address
     * @param authorized Authorization status
     */
    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        authorizedCallers[caller] = authorized;
    }

    /**
     * @dev Update stream parameters
     */
    function updateStreamParams(
        uint256 _minStreamAmount,
        uint256 _minStreamDuration,
        uint256 _maxStreamDuration
    ) external onlyOwner {
        minStreamAmount = _minStreamAmount;
        minStreamDuration = _minStreamDuration;
        maxStreamDuration = _maxStreamDuration;
    }

    /**
     * @dev Pause contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Get contract version
     */
    function getVersion() external pure returns (uint256) {
        return VERSION;
    }

    // Override functions from both VirtualBalance and IStreamLockManager
    function getUnlockedBalance(address user, address token) public view override(VirtualBalance, IStreamLockManager) returns (uint256) {
        return VirtualBalance.getUnlockedBalance(user, token);
    }

    function getTotalBalance(address user, address token) public view override(VirtualBalance, IStreamLockManager) returns (uint256) {
        return VirtualBalance.getTotalBalance(user, token);
    }

    function getLockedBalance(address user, address token) public view override(VirtualBalance, IStreamLockManager) returns (uint256) {
        return VirtualBalance.getLockedBalance(user, token);
    }

    /**
     * @dev Update stream on usage - for internal tracking
     * @param lockId Stream lock ID
     * @param usageAmount Amount used (for logging purposes)
     * @return success Whether update was successful
     */
    function updateStreamOnUsage(bytes32 lockId, uint256 usageAmount) external override onlyAuthorized returns (bool success) {
        TokenLock storage lock = tokenLocks[lockId];
        if (lock.lockId == bytes32(0)) {
            revert StreamNotFound();
        }
        
        if (!lock.isActive) {
            revert StreamNotActive();
        }
        
        // Calculate current accrued amount
        uint256 accrued = calculateAccruedAmount(lockId);
        
        // Emit usage tracking event
        emit StreamUsageRecorded(lockId, usageAmount, accrued, block.timestamp);
        
        return true;
    }

    // New event for usage tracking
    event StreamUsageRecorded(
        bytes32 indexed lockId,
        uint256 usageAmount,
        uint256 accruedAmount,
        uint256 timestamp
    );

    /**
     * @dev Authorize contract upgrades (UUPS pattern)
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ============ EXTENDED FUNCTIONS FOR PLAN INTEGRATIONS ============

    /**
     * @dev Create a vesting stream with cliff period
     * @param user User creating the stream
     * @param recipient Stream recipient (producer)
     * @param token ERC20 token address
     * @param totalAmount Total amount to vest
     * @param cliffDate Cliff period end timestamp
     * @param vestingDuration Total vesting duration
     * @param immediateAmount Amount released immediately
     */
    function createVestingStream(
        address user,
        address recipient,
        address token,
        uint256 totalAmount,
        uint256 cliffDate,
        uint256 vestingDuration,
        uint256 immediateAmount
    ) external onlyAuthorized nonReentrant whenNotPaused returns (bytes32 streamId) {
        require(user != address(0) && recipient != address(0), "Invalid addresses");
        require(token != address(0), "Invalid token");
        require(totalAmount > immediateAmount, "Invalid amounts");
        require(cliffDate > block.timestamp, "Invalid cliff date");
        require(vestingDuration > 0, "Invalid duration");

        // Generate unique stream ID
        streamId = keccak256(abi.encodePacked(
            user, recipient, token, totalAmount, cliffDate, block.timestamp, block.number
        ));

        // Calculate vesting rate (after cliff)
        uint256 vestingAmount = totalAmount - immediateAmount;
        uint256 streamRate = vestingAmount / vestingDuration;

        // Lock tokens
        _depositBalance(user, token, totalAmount);
        _lockBalance(user, token, totalAmount);

        // Create vesting stream
        tokenLocks[streamId] = TokenLock({
            user: user,
            recipient: recipient,
            token: token,
            totalAmount: totalAmount,
            streamRate: streamRate,
            startTime: block.timestamp,
            endTime: cliffDate + vestingDuration,
            lastClaimTime: block.timestamp,
            isActive: true,
            lockId: streamId,
            streamType: StreamType.VESTING,
            cliffDate: cliffDate,
            usageCount: 0,
            usedCount: 0,
            immediateAmount: immediateAmount
        });

        // Update mappings
        userLocks[user].push(streamId);
        recipientLocks[recipient].push(streamId);

        // Transfer immediate amount if any
        if (immediateAmount > 0) {
            IERC20(token).safeTransfer(recipient, immediateAmount);
        }

        emit StreamLockCreated(streamId, user, recipient, token, totalAmount, vestingDuration);
        return streamId;
    }

    /**
     * @dev Create a usage pool for prepaid services
     * @param user User creating the pool
     * @param recipient Service provider (producer)
     * @param token Payment token
     * @param totalAmount Total prepaid amount
     * @param usageCount Total number of usages prepaid
     */
    function createUsagePool(
        address user,
        address recipient,
        address token,
        uint256 totalAmount,
        uint256 usageCount
    ) external onlyAuthorized nonReentrant whenNotPaused returns (bytes32 poolId) {
        require(user != address(0) && recipient != address(0), "Invalid addresses");
        require(token != address(0), "Invalid token");
        require(totalAmount > 0 && usageCount > 0, "Invalid amounts");

        // Generate unique pool ID
        poolId = keccak256(abi.encodePacked(
            user, recipient, token, totalAmount, usageCount, block.timestamp, block.number
        ));

        // Calculate price per usage
        uint256 pricePerUsage = totalAmount / usageCount;

        // Lock tokens
        _depositBalance(user, token, totalAmount);
        _lockBalance(user, token, totalAmount);

        // Create usage pool
        tokenLocks[poolId] = TokenLock({
            user: user,
            recipient: recipient,
            token: token,
            totalAmount: totalAmount,
            streamRate: pricePerUsage, // Store as rate for consistency
            startTime: block.timestamp,
            endTime: block.timestamp + (365 days), // Default 1 year expiry
            lastClaimTime: block.timestamp,
            isActive: true,
            lockId: poolId,
            streamType: StreamType.USAGE_POOL,
            cliffDate: 0,
            usageCount: usageCount,
            usedCount: 0,
            immediateAmount: 0
        });

        // Update mappings
        userLocks[user].push(poolId);
        recipientLocks[recipient].push(poolId);

        emit StreamLockCreated(poolId, user, recipient, token, totalAmount, 0);
        return poolId;
    }

    /**
     * @dev Consume usage from a prepaid pool
     * @param poolId Usage pool ID
     * @param usageAmount Number of usages to consume
     */
    function consumeUsageFromPool(
        bytes32 poolId,
        uint256 usageAmount
    ) external onlyAuthorized nonReentrant returns (bool success) {
        TokenLock storage pool = tokenLocks[poolId];
        
        require(pool.isActive, "Pool not active");
        require(pool.streamType == StreamType.USAGE_POOL, "Not a usage pool");
        require(pool.usedCount + usageAmount <= pool.usageCount, "Insufficient usage balance");

        // Update usage count
        pool.usedCount += usageAmount;
        
        // Calculate amount to transfer
        uint256 transferAmount = pool.streamRate * usageAmount; // streamRate = pricePerUsage
        
        // Transfer to recipient
        IERC20(pool.token).safeTransfer(pool.recipient, transferAmount);
        
        // Unlock the transferred amount
        _unlockBalance(pool.user, pool.token, transferAmount);

        // If all usage consumed, deactivate pool
        if (pool.usedCount >= pool.usageCount) {
            pool.isActive = false;
        }

        emit PartialClaim(poolId, pool.recipient, transferAmount);
        return true;
    }

    /**
     * @dev Link a stream to a customer plan
     * @param customerPlanId Customer plan ID
     * @param streamId Stream ID to link
     */
    function linkStreamToCustomerPlan(
        uint256 customerPlanId,
        bytes32 streamId
    ) external onlyAuthorized {
        require(tokenLocks[streamId].user != address(0), "Stream does not exist");
        customerPlanStreams[customerPlanId] = streamId;
        
        emit CustomerPlanStreamCreated(customerPlanId, streamId, tokenLocks[streamId].user, tokenLocks[streamId].recipient);
    }

    /**
     * @dev Get stream ID linked to a customer plan
     * @param customerPlanId Customer plan ID
     * @return streamId Linked stream ID
     */
    function getCustomerPlanStream(
        uint256 customerPlanId
    ) external view returns (bytes32 streamId) {
        return customerPlanStreams[customerPlanId];
    }

    /**
     * @dev Check if vesting period is active (past cliff)
     * @param lockId Vesting stream ID
     * @return active True if vesting is active
     */
    function isVestingActive(bytes32 lockId) external view returns (bool active) {
        TokenLock storage lock = tokenLocks[lockId];
        require(lock.streamType == StreamType.VESTING, "Not a vesting stream");
        return block.timestamp >= lock.cliffDate && lock.isActive;
    }

    /**
     * @dev Get vesting information
     * @param lockId Vesting stream ID
     * @return cliffDate Cliff period end
     * @return vestedAmount Total vested amount so far
     * @return claimableAmount Amount that can be claimed now
     */
    function getVestingInfo(bytes32 lockId) external view returns (
        uint256 cliffDate,
        uint256 vestedAmount,
        uint256 claimableAmount
    ) {
        TokenLock storage lock = tokenLocks[lockId];
        require(lock.streamType == StreamType.VESTING, "Not a vesting stream");
        
        cliffDate = lock.cliffDate;
        
        if (block.timestamp < lock.cliffDate) {
            // Still in cliff period
            vestedAmount = lock.immediateAmount;
            claimableAmount = 0;
        } else {
            // Calculate vested amount after cliff
            uint256 timeSinceCliff = block.timestamp - lock.cliffDate;
            uint256 vestingDuration = lock.endTime - lock.cliffDate;
            uint256 vestingAmount = lock.totalAmount - lock.immediateAmount;
            
            if (timeSinceCliff >= vestingDuration) {
                vestedAmount = lock.totalAmount;
            } else {
                uint256 timeVested = (vestingAmount * timeSinceCliff) / vestingDuration;
                vestedAmount = lock.immediateAmount + timeVested;
            }
            
            claimableAmount = vestedAmount - (lock.totalAmount - getUnlockedBalance(lock.user, lock.token));
        }
    }

    /**
     * @dev Get usage pool information
     * @param poolId Usage pool ID
     * @return totalUsageCount Total usage count in pool
     * @return usedCount Used usage count
     * @return remainingUsage Remaining usage count
     * @return pricePerUsage Price per single usage
     */
    function getUsagePoolInfo(bytes32 poolId) external view returns (
        uint256 totalUsageCount,
        uint256 usedCount,
        uint256 remainingUsage,
        uint256 pricePerUsage
    ) {
        TokenLock storage pool = tokenLocks[poolId];
        require(pool.streamType == StreamType.USAGE_POOL, "Not a usage pool");
        
        totalUsageCount = pool.usageCount;
        usedCount = pool.usedCount;
        remainingUsage = totalUsageCount - usedCount;
        pricePerUsage = pool.streamRate; // streamRate stores price per usage for pools
    }
}
