// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Base64} from "./../libraries/Base64.sol";
import {DataTypes} from "./../libraries/DataTypes.sol";
import {IProducerStorage} from "./../interfaces/IProducerStorage.sol";
import {IStreamLockManager} from "./../interfaces/IStreamLockManager.sol";
import "../DelegateCall.sol";

/**
 * @title ProducerVestingApi
 * @dev Logic contract for vesting API plans with cliff and stream-based vesting
 * @notice Handles vesting API plan creation, cliff periods, and gradual token release
 */
contract ProducerVestingApi is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    DelegateCall
{
    IProducerStorage public producerStorage;
    IStreamLockManager public streamLockManager;

    event PlanInfoVestingAdded(
        uint256 indexed planId,
        uint32 cliffDate,
        uint256 flowRate,
        uint256 startAmount
    );

    event VestingStarted(
        uint256 indexed customerPlanId,
        address indexed customer,
        uint256 totalAmount,
        uint32 cliffDate
    );

    event TokensClaimed(
        uint256 indexed customerPlanId,
        address indexed customer,
        uint256 claimedAmount,
        uint256 remainingAmount
    );

    event VestingStreamCreated(
        uint256 indexed planId,
        uint256 indexed customerPlanId,
        address indexed customer,
        bytes32 streamId,
        uint256 cliffDate
    );

    function initialize() external initializer onlyProxy {
        __Ownable_init(msg.sender);
    }

    /**
     * @dev Function required by UUPS proxy pattern
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    modifier onlyProducer(address _cloneAddress) {
        require(
            producerStorage.getProducer(_cloneAddress).cloneAddress == msg.sender,
            "Only producer contract can call this function"
        );
        _;
    }

    modifier onlyRightProducer(uint256 _producerId, address cloneAddress) {
        require(
            producerStorage.getCloneId(_producerId) == cloneAddress,
            "Right producer contract can call this function"
        );
        _;
    }

    function setProducerStorage(address _producerStorage) external onlyOwner {
        producerStorage = IProducerStorage(_producerStorage);
    }

    function setStreamLockManager(address _streamLockManager) external onlyOwner {
        streamLockManager = IStreamLockManager(_streamLockManager);
    }

    /**
     * @dev Add vesting API plan information after base plan creation
     * @param _planInfoVesting Vesting API plan specific information
     */
    function addPlanInfoVesting(
        DataTypes.PlanInfoVesting memory _planInfoVesting
    ) external onlyProducer(msg.sender) {
        // Validate plan exists and is vesting API type
        DataTypes.Plan memory plan = producerStorage.getPlan(_planInfoVesting.planId);
        require(plan.planType == DataTypes.PlanTypes.vestingApi, "Plan must be vesting API type");
        
        // Validate cliff date is in the future
        require(_planInfoVesting.cliffDate > uint32(block.timestamp), "Cliff date must be in future");
        
        // Store vesting plan info
        producerStorage.setPlanInfoVesting(_planInfoVesting.planId, _planInfoVesting);
        
        emit PlanInfoVestingAdded(
            _planInfoVesting.planId,
            _planInfoVesting.cliffDate,
            _planInfoVesting.flowRate,
            _planInfoVesting.startAmount
        );
    }

    /**
     * @dev Calculate vested amount for a customer plan
     * @param _customerPlanId Customer plan ID
     * @return vestedAmount Amount available for claiming
     * @return totalAmount Total vesting amount
     */
    function calculateVestedAmount(
        uint256 _customerPlanId
    ) external view returns (uint256 vestedAmount, uint256 totalAmount) {
        DataTypes.CustomerPlan memory customerPlan = producerStorage.getCustomerPlan(_customerPlanId);
        DataTypes.PlanInfoVesting memory vestingInfo = producerStorage.getPlanInfoVesting(customerPlan.planId);
        
        // Check if cliff period has passed
        if (block.timestamp < vestingInfo.cliffDate) {
            return (0, vestingInfo.startAmount);
        }
        
        // Calculate vested amount based on time passed since cliff
        uint256 timeSinceCliff = block.timestamp - vestingInfo.cliffDate;
        uint256 streamedAmount = vestingInfo.flowRate * timeSinceCliff;
        
        // Total vested = start amount + streamed amount (capped by total)
        vestedAmount = vestingInfo.startAmount + streamedAmount;
        totalAmount = vestingInfo.startAmount;
        
        // Cap at remaining quota (total vesting amount)
        if (vestedAmount > customerPlan.remainingQuota) {
            vestedAmount = customerPlan.remainingQuota;
        }
        
        return (vestedAmount, totalAmount);
    }

    /**
     * @dev Claim vested tokens
     * @param _customerPlanId Customer plan ID
     * @param _amount Amount to claim
     */
    function claimVestedTokens(
        uint256 _customerPlanId,
        uint256 _amount
    ) external {
        DataTypes.CustomerPlan memory customerPlan = producerStorage.getCustomerPlan(_customerPlanId);
        
        // Only customer can claim
        require(msg.sender == customerPlan.customerAdress, "Only customer can claim");
        
        // Check if plan is active
        require(customerPlan.status == DataTypes.Status.active, "Customer plan not active");
        
        // Calculate available amount
        (uint256 vestedAmount, ) = this.calculateVestedAmount(_customerPlanId);
        
        // Validate claim amount
        require(_amount <= vestedAmount, "Insufficient vested amount");
        require(_amount > 0, "Amount must be greater than zero");
        
        // Update customer plan - reduce remaining quota
        customerPlan.remainingQuota -= _amount;
        producerStorage.setCustomerPlan(_customerPlanId, customerPlan);
        
        // Here you would transfer actual tokens to customer
        // This would integrate with ERC20 transfer or native token transfer
        
        emit TokensClaimed(
            _customerPlanId,
            customerPlan.customerAdress,
            _amount,
            customerPlan.remainingQuota
        );
    }

    /**
     * @dev Check if cliff period has ended for a customer plan
     * @param _customerPlanId Customer plan ID
     * @return cliffEnded Whether cliff period has ended
     */
    function isCliffEnded(
        uint256 _customerPlanId
    ) external view returns (bool cliffEnded) {
        DataTypes.CustomerPlan memory customerPlan = producerStorage.getCustomerPlan(_customerPlanId);
        DataTypes.PlanInfoVesting memory vestingInfo = producerStorage.getPlanInfoVesting(customerPlan.planId);
        
        return block.timestamp >= vestingInfo.cliffDate;
    }

    /**
     * @dev Get vesting plan information
     * @param _planId Plan ID
     * @return vestingInfo Vesting plan information
     */
    function getPlanInfoVesting(
        uint256 _planId
    ) external view returns (DataTypes.PlanInfoVesting memory vestingInfo) {
        return producerStorage.getPlanInfoVesting(_planId);
    }

    /**
     * @dev Calculate total vesting schedule for a plan
     * @param _planId Plan ID
     * @param _totalAmount Total amount to vest
     * @param _vestingDuration Vesting duration in seconds
     * @return startAmount Amount available after cliff
     * @return flowRate Amount per second after cliff
     */
    function calculateVestingSchedule(
        uint256 _planId,
        uint256 _totalAmount,
        uint256 _vestingDuration
    ) external view returns (uint256 startAmount, uint256 flowRate) {
        DataTypes.PlanInfoVesting memory vestingInfo = producerStorage.getPlanInfoVesting(_planId);
        
        // Start amount is typically a percentage of total (e.g., 25%)
        startAmount = (_totalAmount * 25) / 100; // 25% after cliff
        
        // Remaining amount is streamed over vesting duration
        uint256 remainingAmount = _totalAmount - startAmount;
        flowRate = remainingAmount / _vestingDuration;
        
        return (startAmount, flowRate);
    }

    // ============ STREAM LOCK MANAGER INTEGRATION ============

    /**
     * @dev Create vesting stream for a plan
     * @param _planId Plan ID to subscribe to
     * @param _totalAmount Total amount to vest
     * @param _vestingDuration Duration of vesting after cliff
     * @return streamId Created vesting stream ID
     * @return customerPlanId Created customer plan ID
     */
    function createVestingStream(
        uint256 _planId,
        uint256 _totalAmount,
        uint256 _vestingDuration
    ) external returns (bytes32 streamId, uint256 customerPlanId) {
        require(address(streamLockManager) != address(0), "StreamLockManager not set");
        
        // Get plan information
        DataTypes.Plan memory plan = producerStorage.getPlan(_planId);
        DataTypes.PlanInfoVesting memory vestingInfo = producerStorage.getPlanInfoVesting(_planId);
        
        require(plan.planType == DataTypes.PlanTypes.vestingApi, "Plan must be vesting API type");
        require(plan.status == DataTypes.Status.active, "Plan not active");
        require(_totalAmount > 0, "Invalid total amount");
        require(_vestingDuration > 0, "Invalid vesting duration");
        require(vestingInfo.cliffDate > block.timestamp, "Cliff date must be in future");
        
        // Calculate immediate amount (specified in plan or default percentage)
        uint256 immediateAmount = vestingInfo.startAmount;
        if (immediateAmount == 0) {
            immediateAmount = (_totalAmount * 25) / 100; // Default 25% immediate after cliff
        }
        
        // Create customer plan first
        customerPlanId = _createVestingCustomerPlan(_planId, msg.sender, _totalAmount, vestingInfo.cliffDate);
        
        // Create vesting stream
        streamId = streamLockManager.createVestingStream(
            msg.sender,                // user
            plan.cloneAddress,         // recipient (producer)
            plan.priceAddress,         // payment token
            _totalAmount,              // total amount to vest
            vestingInfo.cliffDate,     // cliff date
            _vestingDuration,          // vesting duration
            immediateAmount            // immediate amount after cliff
        );
        
        // Link stream to customer plan
        streamLockManager.linkStreamToCustomerPlan(customerPlanId, streamId);
        
        emit VestingStreamCreated(_planId, customerPlanId, msg.sender, streamId, vestingInfo.cliffDate);
        
        return (streamId, customerPlanId);
    }

    /**
     * @dev Check vesting status and claimable amount
     * @param _customerPlanId Customer plan ID
     * @return isActive True if vesting is active
     * @return claimableAmount Amount that can be claimed now
     * @return totalVested Total amount vested so far
     */
    function getVestingStatus(
        uint256 _customerPlanId
    ) external view returns (
        bool isActive,
        uint256 claimableAmount,
        uint256 totalVested
    ) {
        require(address(streamLockManager) != address(0), "StreamLockManager not set");
        
        // Get linked stream
        bytes32 streamId = streamLockManager.getCustomerPlanStream(_customerPlanId);
        require(streamId != bytes32(0), "No stream linked to customer plan");
        
        // Get vesting information
        isActive = streamLockManager.isVestingActive(streamId);
        (,totalVested, claimableAmount) = streamLockManager.getVestingInfo(streamId);
        
        return (isActive, claimableAmount, totalVested);
    }

    /**
     * @dev Internal function to create customer plan for vesting
     */
    function _createVestingCustomerPlan(
        uint256 _planId,
        address _customer,
        uint256 _totalAmount,
        uint256 _cliffDate
    ) internal returns (uint256 customerPlanId) {
        
        DataTypes.CustomerPlan memory customerPlan = DataTypes.CustomerPlan({
            customerAdress: _customer,
            planId: _planId,
            custumerPlanId: 0, // Will be set by storage
            producerId: 0, // Will be set by storage
            cloneAddress: address(this),
            priceAddress: address(0), // Will be set from plan info
            startDate: uint32(block.timestamp),
            endDate: uint32(_cliffDate + 365 days), // Default 1 year from cliff
            remainingQuota: _totalAmount, // Use quota to track total vesting amount
            status: DataTypes.Status.active,
            planType: DataTypes.PlanTypes.vestingApi,
            streamId: 0, // Initially no stream
            hasActiveStream: false // Initially no active stream
        });
        
        // Store customer plan
        producerStorage.addCustomerPlan(customerPlan);
        
        // Generate customer plan ID for return
        customerPlanId = uint256(keccak256(abi.encodePacked(_planId, _customer, address(this))));
        
        return customerPlanId;
    }
}
