// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

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
}
