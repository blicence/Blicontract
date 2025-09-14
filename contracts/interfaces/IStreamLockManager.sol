// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

/**
 * @title IStreamLockManager
 * @dev Interface for the StreamLockManager contract that handles token locking and streaming
 */
interface IStreamLockManager {
    
    /// @dev Settlement trigger types
    enum SettlementTrigger {
        UserCancellation,    // Kullanıcı iptal etti
        ProducerClaim,       // Producer talep etti
        AutoExpiration,      // Otomatik süre dolumu
        ConsumerUsage        // Consumer hak kullanımı sırasında
    }

    /// @dev Stream types for different payment models
    enum StreamType {
        REGULAR,        // Normal time-based streaming
        VESTING,        // Cliff + vesting streaming  
        USAGE_POOL      // Prepaid usage pools
    }

    /// @dev Token lock structure
    struct TokenLock {
        address user;               // Token sahibi
        address recipient;          // Akışın alıcısı
        address token;             // ERC20 token adresi
        uint256 totalAmount;       // Toplam kilitli miktar
        uint256 streamRate;        // Saniye başına akış miktarı (wei/sec)
        uint256 startTime;         // Akış başlangıç zamanı
        uint256 endTime;          // Akış bitiş zamanı
        uint256 lastClaimTime;    // Son çekim zamanı
        bool isActive;            // Akış aktif mi?
        bytes32 lockId;           // Benzersiz lock ID
        StreamType streamType;    // Stream türü
        uint256 cliffDate;        // Vesting için cliff tarihi
        uint256 usageCount;       // Usage pool için toplam kullanım sayısı
        uint256 usedCount;        // Usage pool için kullanılan miktar
        uint256 immediateAmount;  // Vesting için anında ödenen miktar
    }

    /// @dev Stream creation parameters
    struct StreamParams {
        address recipient;
        address token;
        uint256 totalAmount;
        uint256 duration;
    }

    // Events
    event StreamLockCreated(
        bytes32 indexed lockId,
        address indexed user,
        address indexed recipient,
        address token,
        uint256 totalAmount,
        uint256 duration
    );

    event StreamSettled(
        bytes32 indexed lockId,
        address indexed user,
        address indexed recipient,
        uint256 settledAmount,
        uint256 returnedAmount,
        SettlementTrigger trigger
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

    event CustomerPlanStreamCreated(
        uint256 indexed customerPlanId,
        bytes32 indexed lockId,
        address indexed customer,
        address producer
    );

    // Core functions
    function createStreamLock(
        address recipient,
        address token,
        uint256 totalAmount,
        uint256 duration
    ) external returns (bytes32 lockId);

    function batchCreateStreams(
        StreamParams[] calldata params
    ) external returns (bytes32[] memory lockIds);

    function cancelStream(bytes32 lockId) external;

    function settleStream(bytes32 lockId) external returns (uint256 settledAmount, uint256 returnedAmount);

    function claimStreamsByProducer() external returns (uint256 totalClaimed);

    function emergencyWithdraw(bytes32 lockId) external;

    // View functions
    function calculateAccruedAmount(bytes32 lockId) external view returns (uint256);

    function calculateRemainingAmount(bytes32 lockId) external view returns (uint256);

    function getStreamStatus(bytes32 lockId) external view returns (
        bool isActive,
        bool isExpired,
        uint256 accruedAmount,
        uint256 remainingAmount,
        uint256 remainingTime
    );

    function getUserActiveStreams(address user) external view returns (bytes32[] memory);

    function getProducerIncomingStreams(address producer) external view returns (bytes32[] memory);

    function getTokenLock(bytes32 lockId) external view returns (TokenLock memory);

    // Balance functions
    function getUnlockedBalance(address user, address token) external view returns (uint256);

    function getTotalBalance(address user, address token) external view returns (uint256);

    function getLockedBalance(address user, address token) external view returns (uint256);

    // Integration functions for Producer contract
    function checkAndSettleOnUsage(address consumer, bytes32 lockId) external returns (bool canUse);

    function validateStreamAccess(address user, bytes32 lockId) external view returns (
        bool hasAccess,
        uint256 accruedAmount
    );

    function createStreamForCustomerPlan(
        uint256 customerPlanId,
        address customer,
        address producer,
        address token,
        uint256 totalAmount,
        uint256 duration
    ) external returns (bytes32 lockId);

    function updateStreamOnUsage(bytes32 lockId, uint256 usageAmount) external returns (bool success);

    // Extended functions for plan integrations
    function createVestingStream(
        address user,
        address recipient,
        address token,
        uint256 totalAmount,
        uint256 cliffDate,
        uint256 vestingDuration,
        uint256 immediateAmount
    ) external returns (bytes32 streamId);
    
    function createUsagePool(
        address user,
        address recipient,
        address token,
        uint256 totalAmount,
        uint256 usageCount
    ) external returns (bytes32 poolId);
    
    function consumeUsageFromPool(
        bytes32 poolId,
        uint256 usageAmount
    ) external returns (bool success);
    
    function linkStreamToCustomerPlan(
        uint256 customerPlanId,
        bytes32 streamId
    ) external;
    
    function getCustomerPlanStream(
        uint256 customerPlanId
    ) external view returns (bytes32 streamId);
    
    function isVestingActive(bytes32 lockId) external view returns (bool active);
    
    function getVestingInfo(bytes32 lockId) external view returns (
        uint256 cliffDate,
        uint256 vestedAmount,
        uint256 claimableAmount
    );
    
    function getUsagePoolInfo(bytes32 poolId) external view returns (
        uint256 totalUsageCount,
        uint256 usedCount,
        uint256 remainingUsage,
        uint256 pricePerUsage
    );
}
