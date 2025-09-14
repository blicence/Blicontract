// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
 

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Base64} from "./../libraries/Base64.sol";
import {DataTypes} from "./../libraries/DataTypes.sol";
import {IProducerStorage} from "./../interfaces/IProducerStorage.sol";
import {IProducerNUsage} from "./../interfaces/IProducerNUsage.sol";
import {IStreamLockManager} from "./../interfaces/IStreamLockManager.sol";

contract ProducerNUsage is
    IProducerNUsage,
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    IProducerStorage public producerStorage;
    IStreamLockManager public streamLockManager;

    event UsagePoolCreated(
        uint256 indexed planId,
        uint256 indexed customerPlanId,
        address indexed customer,
        bytes32 poolId,
        uint256 usageCount
    );

    event ServiceUsed(
        uint256 indexed customerPlanId,
        address indexed customer,
        uint256 usageAmount,
        uint256 remainingUsage
    );

    function initialize() external initializer onlyProxy {
        __Ownable_init(msg.sender);
    }

    /**
     * Function required by UUPS proxy pattern
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    modifier onlyProducer(address _cloneAddress) {
        require(
            producerStorage.getProducer(_cloneAddress).cloneAddress ==
                msg.sender,
            "Only producer contract can call this function"
        );
        _;
    }
    modifier OnlyRightProducer(uint256 _producerId, address cloneAddress) {
        require(
            producerStorage.getCloneId(_producerId) == cloneAddress,
            "right producer contract can call this function"
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
     * @dev Add N-Usage plan information after base plan creation
     * @param _planInfoNUsage N-Usage plan specific information
     */
    function addPlanInfoNUsage(
        DataTypes.PlanInfoNUsage memory _planInfoNUsage
    ) external onlyProducer(msg.sender) {
        // Validate plan exists and is N-Usage type
        DataTypes.Plan memory plan = producerStorage.getPlan(_planInfoNUsage.planId);
        require(plan.planType == DataTypes.PlanTypes.nUsage, "Plan must be N-Usage type");
        
        // Store N-Usage plan info
        producerStorage.setPlanInfoNUsage(_planInfoNUsage.planId, _planInfoNUsage);
    }

    function addCustomerPlan(
        DataTypes.CustomerPlan memory vars
    ) external onlyProducer(vars.cloneAddress) {
        producerStorage.addCustomerPlan(vars);
    }

    function updateCustomerPlan(
        DataTypes.CustomerPlan calldata vars
    )
        external
        onlyProducer(vars.cloneAddress)
        OnlyRightProducer(vars.producerId, vars.cloneAddress)
    {
        producerStorage.updateCustomerPlan(vars);
    }

    function useFromQuota(
        DataTypes.CustomerPlan calldata vars
    )
        external
        onlyProducer(vars.cloneAddress)
        OnlyRightProducer(vars.producerId, vars.cloneAddress)
        returns (uint256)
    {
        return producerStorage.useFromQuota(vars);
    }

    // ============ STREAM LOCK MANAGER INTEGRATION ============

    /**
     * @dev Create a prepaid usage pool for N-Usage plan
     * @param _planId Plan ID to subscribe to
     * @param _usageCount Number of usages to prepay
     * @return poolId Created usage pool ID
     * @return customerPlanId Created customer plan ID
     */
    function createUsagePool(
        uint256 _planId,
        uint256 _usageCount
    ) external returns (bytes32 poolId, uint256 customerPlanId) {
        require(address(streamLockManager) != address(0), "StreamLockManager not set");
        
        // Get plan information
        DataTypes.Plan memory plan = producerStorage.getPlan(_planId);
        DataTypes.PlanInfoNUsage memory nUsageInfo = producerStorage.getPlanInfoNUsage(_planId);
        
        require(plan.planType == DataTypes.PlanTypes.nUsage, "Plan must be N-Usage type");
        require(plan.status == DataTypes.Status.active, "Plan not active");
        require(_usageCount >= nUsageInfo.minUsageLimit, "Below minimum usage limit");
        require(_usageCount <= nUsageInfo.maxUsageLimit, "Above maximum usage limit");
        
        // Calculate total prepaid amount
        uint256 totalAmount = nUsageInfo.oneUsagePrice * _usageCount;
        require(totalAmount > 0, "Invalid total amount");
        
        // Create customer plan first
        customerPlanId = _createUsageCustomerPlan(_planId, msg.sender, _usageCount);
        
        // Create usage pool
        poolId = streamLockManager.createUsagePool(
            msg.sender,            // user
            plan.cloneAddress,     // recipient (producer)
            plan.priceAddress,     // payment token
            totalAmount,           // total prepaid amount
            _usageCount            // number of usages
        );
        
        // Link pool to customer plan
        streamLockManager.linkStreamToCustomerPlan(customerPlanId, poolId);
        
        emit UsagePoolCreated(_planId, customerPlanId, msg.sender, poolId, _usageCount);
        
        return (poolId, customerPlanId);
    }

    /**
     * @dev Use service from prepaid usage pool
     * @param _customerPlanId Customer plan ID
     * @param _usageAmount Number of usages to consume
     * @return success True if usage was successful
     */
    function useServiceFromPool(
        uint256 _customerPlanId,
        uint256 _usageAmount
    ) external returns (bool success) {
        require(address(streamLockManager) != address(0), "StreamLockManager not set");
        
        // Get linked pool
        bytes32 poolId = streamLockManager.getCustomerPlanStream(_customerPlanId);
        require(poolId != bytes32(0), "No usage pool linked to customer plan");
        
        // Get customer plan
        DataTypes.CustomerPlan memory customerPlan = producerStorage.getCustomerPlan(_customerPlanId);
        require(customerPlan.status == DataTypes.Status.active, "Customer plan not active");
        
        // Consume usage from pool
        success = streamLockManager.consumeUsageFromPool(poolId, _usageAmount);
        
        if (success) {
            // Update customer plan quota
            customerPlan.remainingQuota -= _usageAmount;
            producerStorage.setCustomerPlan(_customerPlanId, customerPlan);
            
            emit ServiceUsed(_customerPlanId, customerPlan.customerAdress, _usageAmount, customerPlan.remainingQuota);
        }
        
        return success;
    }

    /**
     * @dev Get usage pool information
     * @param _customerPlanId Customer plan ID
     * @return totalUsageCount Total usage count in pool
     * @return usedCount Used usage count
     * @return remainingUsage Remaining usage count
     * @return pricePerUsage Price per single usage
     */
    function getUsagePoolInfo(
        uint256 _customerPlanId
    ) external view returns (
        uint256 totalUsageCount,
        uint256 usedCount,
        uint256 remainingUsage,
        uint256 pricePerUsage
    ) {
        require(address(streamLockManager) != address(0), "StreamLockManager not set");
        
        // Get linked pool
        bytes32 poolId = streamLockManager.getCustomerPlanStream(_customerPlanId);
        require(poolId != bytes32(0), "No usage pool linked to customer plan");
        
        // Get pool information from StreamLockManager
        return streamLockManager.getUsagePoolInfo(poolId);
    }

    /**
     * @dev Internal function to create customer plan for usage pool
     */
    function _createUsageCustomerPlan(
        uint256 _planId,
        address _customer,
        uint256 _usageCount
    ) internal returns (uint256 customerPlanId) {
        
        DataTypes.CustomerPlan memory customerPlan = DataTypes.CustomerPlan({
            customerAdress: _customer,
            planId: _planId,
            custumerPlanId: 0, // Will be set by storage
            producerId: 0, // Will be set by storage
            cloneAddress: address(this),
            priceAddress: address(0), // Will be set from plan info
            startDate: uint32(block.timestamp),
            endDate: uint32(block.timestamp + 365 days), // Default 1 year expiry
            remainingQuota: _usageCount, // Use quota to track remaining usages
            status: DataTypes.Status.active,
            planType: DataTypes.PlanTypes.nUsage,
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
